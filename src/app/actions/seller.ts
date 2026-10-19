"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser, requireRole, requireUser } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { validImageDataUrl } from "@/lib/images";
import { sendDiscordTestPing, validDiscordWebhookUrl } from "@/lib/discord";
import { publishLive } from "@/lib/live-bus";
import {
  getMentionDirectory,
  getSellerChatRevision,
  getSellerChatUnreadCount,
  type ChatRevision,
} from "@/lib/seller";
import { findMentions } from "@/lib/mentions";
import { listOnlineSellers, type OnlineSeller } from "@/lib/presence";
import { checkThrottle } from "@/lib/throttle";
import { adminUserIds, notify, notifyMany } from "@/lib/notifications";

export type SellerActionResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "STATE"; error: string };

export type CreateListingResult =
  | { ok: true; slug: string }
  | { ok: false; code: "FORBIDDEN" | "INVALID" | "STATE"; error: string };

const chatSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  /** The message this one answers, when the composer is quoting a reply. */
  replyToId: z.string().min(1).max(40).optional(),
});

const messageIdSchema = z.object({ id: z.string().min(1).max(40) });
const editSchema = messageIdSchema.extend({ body: z.string().trim().min(1).max(1000) });

const REPORT_REASONS = ["spam", "kasar", "pribadi"] as const;
const REPORT_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  spam: "spam atau jualan berulang",
  kasar: "kasar, penipuan, atau ancaman",
  pribadi: "membocorkan data pribadi",
};
const reportSchema = messageIdSchema.extend({ reason: z.enum(REPORT_REASONS) });

const CATEGORY_SLUGS = ["gamepass", "item", "gift", "akun", "premium"] as const;
const DELIVERY_KINDS = ["gamepass_auto", "manual", "instant_code", "credential"] as const;

const listingSchema = z.object({
  title: z.string().trim().min(4, "Judul minimal 4 karakter.").max(120),
  categorySlug: z.enum(CATEGORY_SLUGS),
  game: z.string().trim().min(2, "Nama game minimal 2 karakter.").max(80),
  price: z.number().int().min(500, "Harga minimal Rp500.").max(100_000_000),
  stock: z.number().int().min(0).max(100_000),
  deliveryKind: z.enum(DELIVERY_KINDS),
  description: z.string().trim().min(10, "Deskripsi minimal 10 karakter.").max(2000),
  highlights: z.array(z.string().trim().min(2).max(120)).max(6).optional(),
  netRobux: z.number().int().min(1).max(100_000_000).optional(),
  autoReleaseHours: z.number().int().min(1).max(168).optional(),
  instantDelivery: z.boolean().optional(),
  /** optional seller photo (data URL, magic bytes verified server-side) */
  imageUrl: z.string().max(2_100_000).optional(),
});

/** Call out at most this many shops in one message (keeps a copy-paste bomb sane). */
const MENTION_LIMIT = 5;

/** Post a message to the global seller group chat. */
export async function sendSellerChatMessage(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();
  const parsed = chatSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Pesan tidak valid." };
  if (!checkThrottle(`seller-chat:${user.id}`, 5000)) {
    return { ok: false, code: "STATE", error: "Terlalu cepat. Tunggu 5 detik sebelum mengirim lagi." };
  }

  // Any signed-in user who has ever been a seller (or an admin) may post.
  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, kycVerified: true, storeName: true },
  });
  if (user.role !== "admin") {
    if (!profile) {
      return { ok: false, code: "FORBIDDEN", error: "Hanya penjual yang bisa chat di grup ini." };
    }
    if (!profile.kycVerified) {
      return { ok: false, code: "FORBIDDEN", error: "Grup khusus penjual terverifikasi." };
    }
  }

  // A quote must point at a message that is really there: a client can send any
  // id, and a dangling `replyToId` would leave the room rendering a quote of
  // nothing.
  let replyToId: string | null = null;
  if (parsed.data.replyToId) {
    const quoted = await db.sellerChatMessage.findUnique({
      where: { id: parsed.data.replyToId },
      select: { id: true },
    });
    if (!quoted) {
      return { ok: false, code: "STATE", error: "Pesan yang kamu balas sudah tidak ada." };
    }
    replyToId = quoted.id;
  }

  const message = await db.sellerChatMessage.create({
    data: { userId: user.id, body: parsed.data.body, replyToId },
    select: { id: true },
  });
  revalidatePath("/dashboard/penjual/grup");
  // Wake every open room — the sender refreshes its own page right after this
  // action returns, and everyone else's tab updates from the push channel.
  publishLive("chat", "sellers");

  // A mention is the one thing in this room aimed at a specific person, so it
  // uses the same inbox path every other ping does — the bell and the
  // notification page light up, and notify() wakes that user's open streams.
  const calledOut = findMentions(parsed.data.body, await getMentionDirectory())
    .filter((target) => target.userId !== user.id)
    .slice(0, MENTION_LIMIT);
  if (calledOut.length > 0) {
    const sender = profile?.storeName ?? user.username;
    const preview = parsed.data.body.replace(/\s+/g, " ").slice(0, 120);
    for (const target of calledOut) {
      await notify({
        userId: target.userId,
        kind: "chat_message",
        title: `${sender} menyebut @${target.storeName ?? target.username} di grup seller`,
        body: preview,
        // Straight to the message itself: `#chat-<id>` is the anchor the room
        // gives every bubble, so a mention lands on the sentence that named you
        // instead of the top of a 200-message room.
        link: `/dashboard/penjual/grup#chat-${message.id}`,
      });
    }
  }

  return { ok: true };
}

/**
 * Rewrite one of your own messages. The row keeps the original `createdAt`, so
 * the room's order never shifts; `editedAt` is what tells readers it changed.
 */
export async function editSellerChatMessage(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();
  const parsed = editSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Pesan tidak valid." };
  if (!checkThrottle(`seller-chat-edit:${user.id}`, 3000)) {
    return { ok: false, code: "STATE", error: "Terlalu cepat. Tunggu 3 detik." };
  }

  const message = await db.sellerChatMessage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, userId: true, body: true, deletedAt: true },
  });
  if (!message) return { ok: false, code: "STATE", error: "Pesan sudah tidak ada." };
  if (message.userId !== user.id) {
    return { ok: false, code: "FORBIDDEN", error: "Hanya pesanmu sendiri yang bisa diedit." };
  }
  if (message.deletedAt) {
    return { ok: false, code: "STATE", error: "Pesan yang sudah dihapus tidak bisa diedit." };
  }
  // Saving without a change is not an edit — do not stamp the message.
  if (message.body === parsed.data.body) return { ok: true };

  await db.sellerChatMessage.update({
    where: { id: message.id },
    data: { body: parsed.data.body, editedAt: new Date() },
  });
  revalidatePath("/dashboard/penjual/grup");
  publishLive("chat", "sellers");
  return { ok: true };
}

/**
 * Soft-delete a message. The body stays in the row for moderation, but every
 * reader gets a tombstone instead, and replies that quote it say so.
 *
 * Your own messages are always yours to remove; an admin can remove anyone's,
 * which is where a report ends up.
 */
export async function deleteSellerChatMessage(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();
  const parsed = messageIdSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Pesan tidak valid." };

  const message = await db.sellerChatMessage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, userId: true, deletedAt: true },
  });
  if (!message) return { ok: false, code: "STATE", error: "Pesan sudah tidak ada." };
  if (message.userId !== user.id && user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", error: "Hanya pesanmu sendiri yang bisa dihapus." };
  }
  if (message.deletedAt) return { ok: true };

  await db.sellerChatMessage.update({
    where: { id: message.id },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/dashboard/penjual/grup");
  publishLive("chat", "sellers");
  return { ok: true };
}

/**
 * Flag someone else's message for the admins. One report per message per
 * seller: the second attempt is refused with words rather than paging every
 * admin again.
 */
export async function reportSellerChatMessage(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();
  const parsed = reportSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Alasan laporan tidak valid." };
  if (!checkThrottle(`seller-chat-report:${user.id}`, 5000)) {
    return { ok: false, code: "STATE", error: "Terlalu cepat. Tunggu 5 detik." };
  }

  const message = await db.sellerChatMessage.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      userId: true,
      body: true,
      createdAt: true,
      user: {
        select: { username: true, sellerProfile: { select: { storeName: true } } },
      },
    },
  });
  if (!message) return { ok: false, code: "STATE", error: "Pesan sudah tidak ada." };
  if (message.userId === user.id) {
    return { ok: false, code: "STATE", error: "Pesanmu sendiri tidak perlu dilaporkan." };
  }

  const already = await db.sellerChatReport.findUnique({
    where: { messageId_reporterId: { messageId: message.id, reporterId: user.id } },
    select: { id: true },
  });
  if (already) {
    return { ok: false, code: "STATE", error: "Kamu sudah melaporkan pesan ini. Admin sedang meninjaunya." };
  }

  await db.sellerChatReport.create({
    data: { messageId: message.id, reporterId: user.id, reason: parsed.data.reason },
  });

  const reporter = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { storeName: true },
  });
  const reporterName = reporter?.storeName ?? user.username;
  const authorName = message.user.sellerProfile?.storeName ?? message.user.username;
  await notifyMany(await adminUserIds(), {
    kind: "chat_report",
    title: `Laporan grup seller: ${REPORT_LABELS[parsed.data.reason]}`,
    body: `${reporterName} melaporkan pesan ${authorName} — "${message.body.replace(/\s+/g, " ").slice(0, 120)}"`,
    link: `/dashboard/penjual/grup#chat-${message.id}`,
  });
  return { ok: true };
}

/** Who is online in the room right now, for the live presence strip. */
export async function fetchSellerChatPresence(): Promise<OnlineSeller[]> {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "seller" && user.role !== "admin")) return [];
    return listOnlineSellers(user.id);
  } catch {
    return [];
  }
}

/**
 * Move this viewer's read cursor to now — called by the open room once it has
 * actually rendered the newest message on screen. The divider the reader is
 * looking at comes from the cursor as it was at page load, so advancing it here
 * never yanks the line out from under them; it only changes the NEXT visit.
 */
export async function markSellerChatSeen(): Promise<void> {
  try {
    const user = await requireUser();
    await db.user.update({ where: { id: user.id }, data: { groupChatSeenAt: new Date() } });
  } catch {
    // Signed out or a transient blip: the divider simply reappears next visit.
  }
}

/** Unread group-room count for the nav badge, refreshed by the live channel. */
export async function fetchSellerChatUnread(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "seller") return 0;
    return await getSellerChatUnreadCount(user.id);
  } catch {
    return 0;
  }
}

/**
 * Change signal for the seller room. An open chat polls this and only
 * refetches the room when another seller actually posted — no reload needed.
 */
export async function fetchSellerChatRevision(): Promise<ChatRevision> {
  try {
    await requireUser();
    return await getSellerChatRevision();
  } catch {
    return { count: 0, latestId: null };
  }
}

/** Create a new product listing owned by the logged-in seller. */
export async function createSellerListing(rawInput: unknown): Promise<CreateListingResult> {
  const user = await requireRole("seller");

  const parsed = listingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const input = parsed.data;

  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, isOnline: true, kycVerified: true },
  });
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }
  if (!profile.kycVerified) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "KYC belum terverifikasi. Listing hanya bisa dibuat setelah admin menyetujui identitasmu.",
    };
  }

  const category = await db.category.findUnique({
    where: { slug: input.categorySlug },
    select: { slug: true },
  });
  if (!category) {
    return { ok: false, code: "INVALID", error: "Kategori tidak dikenal." };
  }
  if (input.imageUrl && !validImageDataUrl(input.imageUrl, 1_500_000)) {
    return { ok: false, code: "INVALID", error: "Foto harus gambar PNG/JPEG/GIF/WebP maksimal 1,5MB." };
  }

  const base = slugify(input.title) || "listing";
  let slug = base;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const exists = await db.product.findUnique({ where: { slug }, select: { id: true } });
    if (!exists) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const created = await db.product.create({
    data: {
      slug,
      title: input.title,
      categorySlug: input.categorySlug,
      game: input.game,
      netRobux: input.netRobux ?? null,
      pricingMode: input.netRobux ? "cover" : null,
      price: input.price,
      stock: input.stock,
      deliveryKind: input.deliveryKind,
      sellerId: profile.id,
      description: input.description,
      highlights: JSON.stringify(input.highlights ?? []),
      autoReleaseHours: input.autoReleaseHours ?? 24,
      instantDelivery: input.instantDelivery ?? false,
      imageUrl: input.imageUrl ?? null,
    },
    select: { slug: true },
  }).catch((error: unknown) => {
    // Lost the slug lottery after 20 tries (or a concurrent twin) — fail
    // cleanly instead of 500ing on raw P2002.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return null;
    }
    throw error;
  });
  if (!created) {
    return { ok: false, code: "STATE", error: "Gagal membuat slug unik. Coba lagi." };
  }

  revalidatePath("/dashboard/penjual");
  revalidatePath("/katalog");
  revalidatePath(`/produk/${created.slug}`);
  updateTag("catalog");
  return { ok: true, slug: created.slug };
}

const updateListingSchema = z.object({
  productId: z.string().min(1).max(50),
  title: z.string().trim().min(4).max(120),
  price: z.number().int().min(500).max(100_000_000),
  stock: z.number().int().min(0).max(100_000),
  deliveryKind: z.enum(DELIVERY_KINDS),
  description: z.string().trim().min(10).max(2000),
  highlights: z.array(z.string().trim().min(2).max(120)).max(6).optional(),
  autoReleaseHours: z.number().int().min(1).max(168).optional(),
  instantDelivery: z.boolean().optional(),
  imageUrl: z.string().max(2_100_000).optional().nullable(),
});

async function ownProduct(userId: string, productId: string) {
  const profile = await db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!profile) return null;
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, sellerId: true },
  });
  if (!product || product.sellerId !== profile.id) return null;
  return product;
}

/** Seller id when KYC is verified, null otherwise (missing profile included). */
async function requireKycVerified(userId: string): Promise<string | null> {
  const profile = await db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true, kycVerified: true },
  });
  if (!profile || !profile.kycVerified) return null;
  return profile.id;
}

/** Edit an owned listing. Category/game stay fixed — they define the listing. */
export async function updateSellerListing(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = updateListingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "STATE",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const input = parsed.data;

  const product = await ownProduct(user.id, input.productId);
  if (!product) {
    return { ok: false, code: "FORBIDDEN", error: "Listing tidak ditemukan atau bukan milikmu." };
  }
  if (!(await requireKycVerified(user.id))) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "KYC belum terverifikasi. Perubahan listing dinonaktifkan sementara.",
    };
  }
  if (input.imageUrl !== undefined && input.imageUrl !== null && !validImageDataUrl(input.imageUrl, 1_500_000)) {
    return { ok: false, code: "STATE", error: "Foto harus gambar PNG/JPEG/GIF/WebP maksimal 1,5MB." };
  }

  await db.product.update({
    where: { id: product.id },
    data: {
      title: input.title,
      price: input.price,
      stock: input.stock,
      deliveryKind: input.deliveryKind,
      description: input.description,
      // Only touch highlights when the caller sent them — the quick editor
      // doesn't, and must not wipe them.
      ...(input.highlights !== undefined ? { highlights: JSON.stringify(input.highlights) } : {}),
      autoReleaseHours: input.autoReleaseHours ?? 24,
      instantDelivery: input.instantDelivery ?? false,
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    },
  });

  revalidatePath("/dashboard/penjual");
  revalidatePath("/katalog");
  revalidatePath(`/produk/${product.slug}`);
  updateTag("catalog");
  return { ok: true };
}

/** Pause (hide) or resume an owned listing. */
export async function setListingListed(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = z
    .object({ productId: z.string().min(1).max(50), listed: z.boolean() })
    .safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Input tidak valid." };

  const product = await ownProduct(user.id, parsed.data.productId);
  if (!product) {
    return { ok: false, code: "FORBIDDEN", error: "Listing tidak ditemukan atau bukan milikmu." };
  }
  // Pausing is always allowed (safety valve) — resuming needs a verified KYC.
  if (parsed.data.listed && !(await requireKycVerified(user.id))) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "KYC belum terverifikasi. Listing tidak bisa ditayangkan.",
    };
  }

  await db.product.update({
    where: { id: product.id },
    data: { isListed: parsed.data.listed },
  });

  revalidatePath("/dashboard/penjual");
  revalidatePath("/katalog");
  revalidatePath(`/produk/${product.slug}`);
  updateTag("catalog");
  return { ok: true };
}

const TERMINAL_ORDER_STATES = ["completed", "cancelled", "refunded"];

/** Delete an owned listing — only when no live order references it. */
export async function deleteSellerListing(productId: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = z.string().min(1).max(50).safeParse(productId);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Input tidak valid." };

  const product = await ownProduct(user.id, parsed.data);
  if (!product) {
    return { ok: false, code: "FORBIDDEN", error: "Listing tidak ditemukan atau bukan milikmu." };
  }

  const live = await db.order.count({
    where: { productId: product.id, status: { notIn: TERMINAL_ORDER_STATES } },
  });
  if (live > 0) {
    return {
      ok: false,
      code: "STATE",
      error: `Masih ada ${live} pesanan berjalan memakai listing ini. Jeda dulu, hapus setelah semua selesai.`,
    };
  }

  await db.product.delete({ where: { id: product.id } });

  revalidatePath("/dashboard/penjual");
  revalidatePath("/katalog");
  updateTag("catalog");
  return { ok: true };
}

/** Toggle the seller's online presence flag. */
export async function setSellerOnline(online: boolean): Promise<SellerActionResult> {
  const user = await requireRole("seller");
  if (typeof online !== "boolean") {
    return { ok: false, code: "STATE", error: "Nilai tidak valid." };
  }

  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, kycVerified: true },
  });
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }
  if (!profile.kycVerified) {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "KYC belum terverifikasi. Toko tidak bisa dibuka sebelum admin menyetujui identitasmu.",
    };
  }

  await db.sellerProfile.update({
    where: { id: profile.id },
    data: { isOnline: online },
  });
  revalidatePath("/dashboard/penjual");
  updateTag("catalog");
  return { ok: true };
}

const resubmitSchema = z.object({
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter.").max(100),
  idCardImage: z.string().min(100, "Foto KTP wajib diunggah.").max(1_800_000),
  selfieImage: z.string().min(100, "Selfie + KTP wajib diunggah.").max(1_800_000),
});

/** Rejected sellers upload fresh documents and re-enter the KYC queue. */
export async function resubmitKyc(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = resubmitSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "STATE",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const { fullName, idCardImage, selfieImage } = parsed.data;
  if (!validImageDataUrl(idCardImage, 1_000_000) || !validImageDataUrl(selfieImage, 1_000_000)) {
    return {
      ok: false,
      code: "STATE",
      error: "Dokumen harus gambar PNG/JPEG/GIF/WebP, maksimal 1MB per file.",
    };
  }

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { kycStatus: true, username: true, sellerProfile: { select: { id: true, storeName: true } } },
  });
  if (!account?.sellerProfile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }
  if (account.kycStatus !== "rejected") {
    return { ok: false, code: "STATE", error: "Hanya pengajuan yang ditolak yang bisa diajukan ulang." };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { kycStatus: "pending" } }),
    db.sellerProfile.update({
      where: { id: account.sellerProfile.id },
      data: {
        fullName,
        idCardImage,
        selfieImage,
        kycVerified: false,
        kycRejectReason: null,
        isOnline: false,
      },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "kyc.resubmit",
        targetResource: "users",
        targetId: user.id,
        diffPayload: `{ kyc_status: "rejected → pending", username: "${account.username}" }`,
        ipAddress: "0.0.0.0",
        actor: user.email,
      },
    }),
  ]);

  await notifyMany(await adminUserIds(), {
    kind: "kyc_submitted",
    title: `KYC diajukan ulang oleh ${account.username}`,
    body: `Toko "${account.sellerProfile.storeName}" mengirim berkas baru.`,
    link: "/admin?tab=kyc",
  });
  revalidatePath("/dashboard/penjual");
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Allow an admin to activate a seller profile on their own account so they can
 * preview the seller dashboard with real data. This is meant for admin/testing
 * only; real sellers must go through the KYC registration flow.
 */
export async function activateAdminSeller(): Promise<SellerActionResult> {
  const user = await requireUser();
  if (user.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", error: "Hanya admin yang boleh mengaktifkan mode penjual." };
  }

  const existing = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, code: "STATE", error: "Akun ini sudah memiliki profil penjual." };
  }

  const handleBase = user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "admin";
  let handle = handleBase;
  let suffix = 0;
  while (await db.sellerProfile.findUnique({ where: { handle }, select: { id: true } })) {
    suffix += 1;
    handle = `${handleBase}${suffix}`;
  }

  await db.sellerProfile.create({
    data: {
      userId: user.id,
      storeName: `${user.username} Store`,
      handle,
      city: "Jakarta",
      bio: "Akun penjual admin untuk preview dashboard.",
      kycVerified: true,
      tier: 3,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard/penjual");
  return { ok: true };
}

const applySellerSchema = z.object({
  storeName: z.string().trim().min(3, "Nama toko minimal 3 karakter.").max(60),
  fullName: z.string().trim().min(3, "Nama lengkap minimal 3 karakter.").max(100),
  idCardImage: z.string().min(100, "Foto KTP wajib diunggah.").max(1_800_000),
  selfieImage: z.string().min(100, "Selfie + KTP wajib diunggah.").max(1_800_000),
});

/**
 * Self-service: an existing buyer applies to become a seller.
 *
 * This is the missing door the profile page never had — before, the only paths
 * to selling were registering a brand-new account or asking an admin, so a
 * signed-in buyer was stuck at "Hubungi admin". Here the account keeps its
 * history and gains a SellerProfile in `pending`:
 *
 *   - role flips to `seller` immediately (so the dashboard is reachable), but
 *     `kycStatus` is `pending` and the profile's `kycVerified` is false, and the
 *     seller can already see the "KYC menunggu" gate — no listing, no online
 *     toggle until an admin approves. That matches `registerSellerAction`, which
 *     also creates a pending profile and waits for review.
 *   - documents are validated the same way KYC does (real image bytes, 1MB cap),
 *     because `approveKyc` refuses doc-less approvals.
 *   - an existing profile (e.g. re-applying after a demote) is reused rather than
 *     duplicated — `SellerProfile.userId` is unique.
 */
export async function applyAsSeller(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();

  const parsed = applySellerSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "STATE",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  if (user.role === "seller") {
    return { ok: false, code: "STATE", error: "Akun ini sudah penjual." };
  }
  if (user.role === "admin") {
    return { ok: false, code: "FORBIDDEN", error: "Admin memakai aktivasi dari Super Dashboard." };
  }

  const { storeName, fullName, idCardImage, selfieImage } = parsed.data;
  if (!validImageDataUrl(idCardImage, 1_000_000) || !validImageDataUrl(selfieImage, 1_000_000)) {
    return {
      ok: false,
      code: "STATE",
      error: "Dokumen harus gambar PNG/JPEG/GIF/WebP, maksimal 1MB per file.",
    };
  }

  const account = await db.user.findUnique({
    where: { id: user.id },
    select: { username: true, kycStatus: true, sellerProfile: { select: { id: true } } },
  });
  if (!account) return { ok: false, code: "FORBIDDEN", error: "Akun tidak ditemukan." };
  if (account.kycStatus === "pending") {
    return { ok: false, code: "STATE", error: "Pengajuanmu masih menunggu review admin." };
  }

  const handleBase = account.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "toko";
  let handle = handleBase;
  let suffix = 0;
  while (await db.sellerProfile.findUnique({ where: { handle }, select: { id: true } })) {
    suffix += 1;
    handle = `${handleBase}${suffix}`;
  }

  await db.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: user.id, role: "buyer" },
      data: { role: "seller", kycStatus: "pending" },
    });
    if (updated.count === 0) throw new Error("stale");
    if (account.sellerProfile) {
      await tx.sellerProfile.update({
        where: { id: account.sellerProfile.id },
        data: {
          storeName,
          fullName,
          idCardImage,
          selfieImage,
          kycVerified: false,
          kycRejectReason: null,
          isOnline: false,
        },
      });
    } else {
      await tx.sellerProfile.create({
        data: {
          userId: user.id,
          storeName,
          handle,
          tier: 1,
          city: "-",
          bio: "Toko baru, menunggu verifikasi KYC.",
          fullName,
          idCardImage,
          selfieImage,
        },
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actionType: "kyc.apply",
        targetResource: "users",
        targetId: user.id,
        diffPayload: `{ role: "buyer → seller", kyc_status: "none → pending", username: "${account.username}", store: "${storeName}" }`,
        ipAddress: "0.0.0.0",
        actor: user.email,
      },
    });
  });

  await notifyMany(await adminUserIds(), {
    kind: "kyc_submitted",
    title: `Pengajuan penjual baru dari ${account.username}`,
    body: `Toko "${storeName}" mengajukan diri sebagai penjual dan menunggu verifikasi identitas.`,
    link: "/admin?tab=kyc",
  });
  revalidatePath("/profil");
  revalidatePath("/dashboard/penjual");
  revalidatePath("/admin");
  return { ok: true };
}

const webhookSchema = z.object({
  url: z.string().trim().min(1, "URL wajib diisi.").max(500),
});

async function ownSellerProfile(userId: string) {
  return db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true, storeName: true },
  });
}

/** Save (and re-enable) the seller's Discord pool-alert webhook. */
export async function saveSellerWebhook(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = webhookSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, code: "STATE", error: "URL tidak valid." };
  }
  if (!validDiscordWebhookUrl(parsed.data.url)) {
    return {
      ok: false,
      code: "STATE",
      error: "Harus URL webhook channel Discord (https://discord.com/api/webhooks/…).",
    };
  }

  const profile = await ownSellerProfile(user.id);
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }

  await db.sellerProfile.update({
    where: { id: profile.id },
    data: { discordWebhookUrl: parsed.data.url.trim(), discordWebhookEnabled: true },
  });
  revalidatePath("/dashboard/penjual");
  return { ok: true };
}

/** Remove the seller's Discord webhook (keeps the enabled flag as-is). */
export async function deleteSellerWebhook(): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const profile = await ownSellerProfile(user.id);
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }

  await db.sellerProfile.update({
    where: { id: profile.id },
    data: { discordWebhookUrl: null },
  });
  revalidatePath("/dashboard/penjual");
  return { ok: true };
}

/** Pause/resume pool pings without deleting the URL. */
export async function setSellerWebhookEnabled(enabled: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");
  if (typeof enabled !== "boolean") {
    return { ok: false, code: "STATE", error: "Nilai tidak valid." };
  }

  const profile = await ownSellerProfile(user.id);
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }

  await db.sellerProfile.update({
    where: { id: profile.id },
    data: { discordWebhookEnabled: enabled },
  });
  revalidatePath("/dashboard/penjual");
  return { ok: true };
}

/** Send a test ping to the saved webhook URL. */
export async function testSellerWebhook(): Promise<SellerActionResult> {
  const user = await requireRole("seller");
  if (!checkThrottle(`webhook-test:${user.id}`, 15000)) {
    return { ok: false, code: "STATE", error: "Terlalu cepat. Tunggu 15 detik." };
  }

  const profile = await db.sellerProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, storeName: true, discordWebhookUrl: true },
  });
  if (!profile?.discordWebhookUrl) {
    return { ok: false, code: "STATE", error: "Belum ada URL webhook tersimpan." };
  }

  const delivered = await sendDiscordTestPing(profile.discordWebhookUrl, profile.storeName);
  if (!delivered) {
    return {
      ok: false,
      code: "STATE",
      error: "Gagal terkirim. Periksa URL (mungkin terhapus di Discord), lalu simpan ulang.",
    };
  }
  return { ok: true };
}

const storeProfileSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(3, "Nama toko minimal 3 karakter.")
    .max(60, "Nama toko maksimal 60 karakter."),
  city: z.string().trim().min(2, "Kota minimal 2 karakter.").max(60, "Kota maksimal 60 karakter."),
  bio: z.string().trim().max(280, "Bio maksimal 280 karakter."),
  /** null / "" clears the logo; a data URL (≤300KB) sets it. Omitted = leave as-is. */
  storeImage: z.string().max(500_000).nullable().optional(),
});

/** Update the seller's public store profile: name, city, bio, and logo. */
export async function updateSellerProfile(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireRole("seller");

  const parsed = storeProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "STATE",
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const profile = await ownSellerProfile(user.id);
  if (!profile) {
    return { ok: false, code: "FORBIDDEN", error: "Profil penjual tidak ditemukan." };
  }

  const { storeName, city, bio, storeImage } = parsed.data;
  if (storeImage && !validImageDataUrl(storeImage, 300_000)) {
    return {
      ok: false,
      code: "STATE",
      error: "Logo toko harus gambar PNG/JPEG/GIF/WebP maksimal 300KB.",
    };
  }

  await db.sellerProfile.update({
    where: { id: profile.id },
    data: {
      storeName,
      city,
      bio,
      ...(storeImage !== undefined ? { storeImage: storeImage || null } : {}),
    },
  });

  const products = await db.product.findMany({
    where: { sellerId: profile.id },
    select: { slug: true },
  });
  revalidatePath("/dashboard/penjual");
  revalidatePath("/dashboard/penjual/pengaturan");
  revalidatePath("/katalog");
  revalidatePath("/");
  for (const product of products) revalidatePath(`/produk/${product.slug}`);
  updateTag("catalog");
  return { ok: true };
}
