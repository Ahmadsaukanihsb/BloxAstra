"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { validImageDataUrl } from "@/lib/images";
import { sendDiscordTestPing, validDiscordWebhookUrl } from "@/lib/discord";
import { checkThrottle } from "@/lib/throttle";
import { adminUserIds, notifyMany } from "@/lib/notifications";

export type SellerActionResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "STATE"; error: string };

export type CreateListingResult =
  | { ok: true; slug: string }
  | { ok: false; code: "FORBIDDEN" | "INVALID" | "STATE"; error: string };

const chatSchema = z.object({
  body: z.string().trim().min(1).max(1000),
});

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

/** Post a message to the global seller group chat. */
export async function sendSellerChatMessage(rawInput: unknown): Promise<SellerActionResult> {
  const user = await requireUser();
  const parsed = chatSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, code: "STATE", error: "Pesan tidak valid." };
  if (!checkThrottle(`seller-chat:${user.id}`, 5000)) {
    return { ok: false, code: "STATE", error: "Terlalu cepat. Tunggu 5 detik sebelum mengirim lagi." };
  }

  // Any signed-in user who has ever been a seller (or an admin) may post.
  if (user.role !== "admin") {
    const profile = await db.sellerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true, kycVerified: true },
    });
    if (!profile) {
      return { ok: false, code: "FORBIDDEN", error: "Hanya penjual yang bisa chat di grup ini." };
    }
    if (!profile.kycVerified) {
      return { ok: false, code: "FORBIDDEN", error: "Grup khusus penjual terverifikasi." };
    }
  }

  await db.sellerChatMessage.create({
    data: { userId: user.id, body: parsed.data.body },
  });
  revalidatePath("/dashboard/penjual/grup");
  return { ok: true };
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
    link: "/dashboard/admin",
  });
  revalidatePath("/dashboard/penjual");
  revalidatePath("/dashboard/admin");
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

  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/penjual");
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
