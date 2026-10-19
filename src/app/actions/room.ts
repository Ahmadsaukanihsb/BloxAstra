"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getCurrentUser, requireOrderParticipant } from "@/lib/auth";
import { decryptCredentials } from "@/lib/credentials";
import { validImageDataUrl } from "@/lib/images";
import { getOrderUnreadTotal } from "@/lib/orders";
import { checkThrottle } from "@/lib/throttle";
import { adminUserIds, notify, notifyMany } from "@/lib/notifications";
import {
  DISPUTE_OPEN_STATE,
  DISPUTE_SELLER_REPLIED_STATE,
  isDecidableDispute,
} from "@/lib/order-meta";

export type RoomActionResult =
  | { ok: true }
  | { ok: false; code: "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "STATE"; error: string };

type RoomErrorCode = Extract<RoomActionResult, { ok: false }>["code"];

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}

const CODE_PATTERN = /^BX-[A-Z0-9]{6}$/;

const messageSchema = z
  .object({
    orderCode: z.string().regex(CODE_PATTERN),
    body: z.string().trim().max(2000),
    image: z.string().max(2_200_000).optional(),
  })
  .refine((value) => value.body.length > 0 || value.image !== undefined, {
    message: "Tulis pesan atau lampirkan gambar.",
  });

const disputeSchema = z.object({
  orderCode: z.string().regex(CODE_PATTERN),
  reasonId: z.enum(["not_received", "item_invalid", "account_banned_carding", "seller_unresponsive"]),
  buyerNote: z.string().trim().min(12).max(2000),
  evidence: z.array(z.string().max(2_200_000)).max(3).optional(),
});

const replySchema = z.object({
  orderCode: z.string().regex(CODE_PATTERN),
  sellerReply: z.string().trim().min(12).max(2000),
});

/** Dispute evidence: up to 3 images, each ≤1.5MB, magic bytes verified. */
function validEvidence(value: unknown): value is string {
  return validImageDataUrl(value, 1_500_000);
}

const DISPUTE_REASON_LABELS: Record<string, string> = {
  not_received: "Barang tidak diterima",
  item_invalid: "Item tidak sesuai",
  account_banned_carding: "Akun kena banned / carding",
  seller_unresponsive: "Penjual tidak merespons",
};

function fail(
  code: "FORBIDDEN" | "INVALID" | "NOT_FOUND" | "STATE",
  error: string,
): RoomActionResult {
  return { ok: false, code, error };
}

function validCode(orderCode: unknown): orderCode is string {
  return typeof orderCode === "string" && CODE_PATTERN.test(orderCode);
}

class AbortTxError extends Error {
  constructor(
    public code: RoomErrorCode,
    public reason: string,
  ) {
    super(reason);
  }
}

function isUniqueCollision(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

async function loadParticipant(orderCode: string) {
  const order = await db.order.findUnique({
    where: { code: orderCode },
    select: { id: true },
  });
  if (!order) return null;
  return requireOrderParticipant(order.id);
}

/** Append a ledger row on top of the user's running balance. */
async function appendLedger(
  tx: Prisma.TransactionClient,
  data: {
    userId: string;
    sellerId?: string | null;
    type: string;
    amount: number;
    note: string;
    orderCode?: string;
  },
) {
  const aggregate = await tx.walletLedger.aggregate({
    where: { userId: data.userId },
    _sum: { amount: true },
  });
  const balanceAfter = (aggregate._sum.amount ?? 0) + data.amount;
  return tx.walletLedger.create({
    data: {
      userId: data.userId,
      sellerId: data.sellerId ?? null,
      type: data.type,
      amount: data.amount,
      balanceAfter,
      note: data.note,
      orderCode: data.orderCode ?? null,
    },
  });
}

/**
 * Phrases that give away a move off the platform. Deliberately narrow: a false
 * positive only costs one system notice, but a wall of them would train people
 * to ignore the real one.
 */
const OFF_PLATFORM_PATTERNS: RegExp[] = [
  /(?:wa\.me|t\.me|whatsapp\.com)/i,
  /\b(?:whatsapps?|telegrams?)\b/i,
  /\bwa\s+(?:aku|saya|gue|kamu|nomor|nya)\b/i,
  /(?:luar\s*(?:aplikasi|platform)|di\s*luar\s*blox)/i,
  /(?:transfer|bayar)\s*(?:langsung|diluar|di\s*luar)/i,
  /\b(?:nomor\s+rekening|rekening\s+(?:bank|pribadi))\b/i,
  /\b(?:gopay|ovo|shopeepay)\b/i,
  /\bdana\s+(?:ke\s+nomor|nomor|rekening)\b/i,
];

function looksOffPlatform(body: string): boolean {
  // Flatten separators so "0812-3456-7890" and "+62 812 3456 7890" still read
  // as the one phone number they are.
  const flat = body.replace(/[\s.\-()]/g, "");
  if (/(?:\+?62|0)8\d{8,12}/.test(flat)) return true;
  return OFF_PLATFORM_PATTERNS.some((pattern) => pattern.test(body));
}

/** Buyer (or seller) sends a chat message in the order room. */
export async function sendRoomMessage(rawInput: unknown): Promise<RoomActionResult> {
  const parsed = messageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail("INVALID", parsed.error.issues[0]?.message ?? "Pesan tidak valid.");
  }

  const participant = await loadParticipant(parsed.data.orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");

  // The room is part of the escrow workflow, not a mailbox: once the order is
  // settled there is nothing left to coordinate, and a closed room keeps
  // "lanjut di luar platform" drift out of finished orders.
  if (["completed", "cancelled", "refunded"].includes(participant.order.status)) {
    return fail("STATE", "Pesanan sudah selesai — ruang obrolan ditutup.");
  }

  const image = parsed.data.image;
  if (image !== undefined && !validImageDataUrl(image, 1_500_000)) {
    return fail("INVALID", "Lampiran harus gambar PNG/JPEG/GIF/WebP maksimal 1,5MB.");
  }

  // Each message pings the other side — throttle so a loop can't flood the
  // Message table and the recipient's inbox.
  if (!checkThrottle(`room-msg:${participant.user.id}`, 3000)) {
    return fail("STATE", "Terlalu cepat. Tunggu 3 detik sebelum mengirim lagi.");
  }

  const fromRole = participant.order.buyerId === participant.user.id ? "buyer" : "seller";
  await db.message.create({
    data: {
      orderId: participant.order.id,
      fromRole,
      body: parsed.data.body,
      image: image ?? null,
    },
  });

  // Off-platform drift is the leading edge of every escrow scam. The message
  // still goes through — a false positive must never silence anyone — but both
  // sides get one system reminder per order per 30 minutes.
  if (
    looksOffPlatform(parsed.data.body) &&
    checkThrottle(`scam-warn:${participant.order.id}`, 30 * 60_000)
  ) {
    await db.message.create({
      data: {
        orderId: participant.order.id,
        fromRole: "system",
        body: "Peringatan sistem: pesan ini terindikasi mengarah ke transaksi atau komunikasi di luar Blox Astra. Transaksi di luar platform tidak dilindungi escrow dan tidak bisa dimediasi. Semua pembayaran wajib lewat ruang pesanan.",
      },
    });
  }

  const preview = parsed.data.body || "📷 Foto";

  // Ping the other side so replies are never missed.
  if (fromRole === "buyer" && participant.order.sellerId) {
    const profile = await db.sellerProfile.findUnique({
      where: { id: participant.order.sellerId },
      select: { userId: true },
    });
    if (profile) {
      await notify({
        userId: profile.userId,
        kind: "chat_message",
        title: `Pesan baru di ${parsed.data.orderCode}`,
        body: preview.slice(0, 120),
        link: `/pesanan/${parsed.data.orderCode}`,
      });
    }
  } else if (fromRole !== "buyer") {
    await notify({
      userId: participant.order.buyerId,
      kind: "chat_message",
      title: `Penjual membalas di ${parsed.data.orderCode}`,
      body: preview.slice(0, 120),
      link: `/pesanan/${parsed.data.orderCode}`,
    });
  }

  revalidatePath(`/pesanan/${parsed.data.orderCode}`);
  return { ok: true };
}

/**
 * Move the viewer's read cursor on this order to now — called by the open room
 * once it has the newest messages on screen. Raw SQL on purpose: a normal
 * update would bump `Order.updatedAt`, and that field feeds the 7-day
 * credential wipe, so reading chat must never prolong it.
 */
export async function markOrderSeen(orderCode: string): Promise<void> {
  try {
    if (!validCode(orderCode)) return;
    const participant = await loadParticipant(orderCode);
    if (!participant) return;
    const now = new Date();
    if (participant.order.buyerId === participant.user.id) {
      await db.$executeRaw`UPDATE "Order" SET "buyerReadAt" = ${now} WHERE id = ${participant.order.id}`;
    } else if (participant.user.role !== "admin") {
      await db.$executeRaw`UPDATE "Order" SET "sellerReadAt" = ${now} WHERE id = ${participant.order.id}`;
    }
  } catch {
    // Signed out or a transient blip: the badge simply reappears next visit.
  }
}

/** Unread chat total across the viewer's orders, for the "Pesanan" nav badge. */
export async function fetchOrderUnreadTotal(): Promise<number> {
  try {
    const user = await getCurrentUser();
    if (!user) return 0;
    return await getOrderUnreadTotal(user.id, user.role);
  } catch {
    return 0;
  }
}

/** Buyer confirms receipt — releases escrow to the seller wallet. */
export async function confirmOrderReceived(orderCode: string): Promise<RoomActionResult> {
  if (!validCode(orderCode)) return fail("INVALID", "Kode pesanan tidak valid.");

  const participant = await loadParticipant(orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.buyerId !== participant.user.id) {
    return fail("FORBIDDEN", "Hanya pembeli yang bisa mengonfirmasi penerimaan.");
  }

  const order = await db.order.findUnique({
    where: { id: participant.order.id },
    include: { seller: { select: { id: true, userId: true } } },
  });
  if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  // Escrow releases only after delivery: the seller must have pressed
  // "tandai barang terkirim" first — that is what starts the confirm window.
  if (order.status !== "shipped") {
    return fail("STATE", "Pesanan belum ditandai terkirim oleh penjual.");
  }
  const seller = order.seller;
  if (!seller) return fail("STATE", "Pesanan belum punya penjual.");

  const sellerEarning = order.total - order.platformFee;
  try {
    await db.$transaction(async (tx) => {
      const alreadyPaid = await tx.walletLedger.findFirst({
        where: { orderCode: order.code, type: "earning" },
        select: { id: true },
      });
      if (alreadyPaid) {
        throw new AbortTxError("STATE", "Dana order ini sudah pernah dicairkan.");
      }

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "shipped" },
        data: { status: "completed", autoReleaseAt: null },
      });
      if (updated.count === 0) {
        throw new AbortTxError("STATE", "Pesanan belum ditandai terkirim oleh penjual.");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "completed",
          label: "Pembeli mengonfirmasi barang diterima, dana dilepas",
          actor: "buyer",
        },
      });
      await tx.message.create({
        data: {
          orderId: order.id,
          fromRole: "system",
          body: "Pembeli mengonfirmasi barang diterima. Dana diteruskan ke penjual. Pesanan selesai.",
        },
      });
      await tx.sellerProfile.update({
        where: { id: seller.id },
        data: { ordersCompleted: { increment: 1 } },
      });
      await appendLedger(tx, {
        userId: seller.userId,
        sellerId: seller.id,
        type: "earning",
        amount: sellerEarning,
        note: `Pencairan dana order ${order.code}`,
        orderCode: order.code,
      });
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.code, err.reason);
    if (isUniqueCollision(err)) return fail("STATE", "Dana order ini sudah pernah dicairkan.");
    throw err;
  }

  await notify({
    userId: seller.userId,
    kind: "order_completed",
    title: `Dana ${orderCode} cair ke dompetmu`,
    body: `Pembeli mengonfirmasi penerimaan. ${order.code} selesai.`,
    link: `/pesanan/${orderCode}`,
  });

  revalidatePath(`/pesanan/${orderCode}`);
  return { ok: true };
}

/** Buyer cancels an AFK order — full refund, stock restored. */
export async function cancelOrderAfk(orderCode: string): Promise<RoomActionResult> {
  if (!validCode(orderCode)) return fail("INVALID", "Kode pesanan tidak valid.");

  const participant = await loadParticipant(orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.buyerId !== participant.user.id) {
    return fail("FORBIDDEN", "Hanya pembeli yang bisa membatalkan.");
  }

  const order = await db.order.findUnique({
    where: { id: participant.order.id },
    include: {
      dispute: { select: { id: true } },
      buyer: { select: { id: true } },
      seller: { select: { id: true, userId: true } },
      events: { orderBy: { at: "asc" } },
    },
  });
  if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.status !== "processing") {
    return fail("STATE", "Pembatalan AFK hanya untuk pesanan yang sedang diproses.");
  }
  if (order.dispute) {
    return fail("STATE", "Pesanan sedang dalam sengketa. Hubungi admin.");
  }

  const processingEvent = order.events.find((event) => event.state === "processing");
  if (!processingEvent) {
    return fail("STATE", "Pesanan belum dimulai oleh penjual.");
  }
  if (Date.now() - processingEvent.at.getTime() <= 30 * 60_000) {
    return fail("STATE", "Pembatalan AFK tersedia setelah penjual tidak merespons selama 30 menit.");
  }

  try {
    await db.$transaction(async (tx) => {
      const alreadyRefunded = await tx.walletLedger.findFirst({
        where: { orderCode: order.code, type: "refund" },
        select: { id: true },
      });
      if (alreadyRefunded) {
        throw new AbortTxError("STATE", "Refund untuk order ini sudah pernah dilakukan.");
      }

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "processing" },
        data: { status: "refunded" },
      });
      if (updated.count === 0) {
        throw new AbortTxError("STATE", "Pesanan tidak dalam status yang bisa dibatalkan.");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "refunded",
          label: "Pembeli membatalkan, refund penuh dikirim",
          actor: "buyer",
        },
      });
      if (order.productId) {
        await tx.product.update({
          where: { id: order.productId },
          data: { stock: { increment: order.quantity } },
        });
      }
      await appendLedger(tx, {
        userId: order.buyer.id,
        type: "refund",
        amount: order.total,
        note: `Refund pesanan ${order.code}`,
        orderCode: order.code,
      });
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.code, err.reason);
    if (isUniqueCollision(err)) return fail("STATE", "Refund untuk order ini sudah pernah dilakukan.");
    throw err;
  }

  if (order.productId) updateTag("catalog");
  revalidatePath(`/pesanan/${orderCode}`);
  if (order.seller) {
    await notify({
      userId: order.seller.userId,
      kind: "order_refunded",
      title: `${orderCode} dibatalkan pembeli (AFK)`,
      body: "Penjual tidak merespons 30 menit. Dana dikembalikan ke pembeli.",
      link: `/pesanan/${orderCode}`,
    });
  }
  return { ok: true };
}

/** Buyer files a dispute — freezes escrow, opens admin queue. */
export async function fileOrderDispute(rawInput: unknown): Promise<RoomActionResult> {
  const parsed = disputeSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail("INVALID", parsed.error.issues[0]?.message ?? "Sengketa tidak valid.");
  }

  const participant = await loadParticipant(parsed.data.orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.buyerId !== participant.user.id) {
    return fail("FORBIDDEN", "Hanya pembeli yang bisa mengajukan sengketa.");
  }

  const order = await db.order.findUnique({
    where: { id: participant.order.id },
    include: {
      dispute: { select: { id: true } },
      seller: { select: { id: true, userId: true, storeName: true } },
    },
  });
  if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (!["paid", "processing", "shipped"].includes(order.status)) {
    return fail("STATE", "Pesanan tidak dalam status yang bisa disengketakan.");
  }
  if (order.dispute) {
    return fail("STATE", "Sengketa untuk pesanan ini sudah terbuka.");
  }

  const ref = `DSP-${order.code}`;
  const evidence = parsed.data.evidence ?? [];
  if (!evidence.every(validEvidence)) {
    return fail("INVALID", "Bukti harus gambar PNG/JPEG/GIF/WebP, maksimal 3 file @1,5MB.");
  }
  const ip = await clientIp();
  // Interactive tx with a STATUS-GUARDED order flip. The pre-read above is only
  // a fast path: a concurrent confirm/sweep/cancel can land between it and here
  // (e.g. buyer confirms receipt, escrow released). An unguarded update would
  // then revive a completed/refunded order as `disputed` and let admin pay both
  // sides. AbortTxError rolls the whole dispute back when that race is lost.
  try {
    await db.$transaction(async (tx) => {
      const flipped = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["paid", "processing", "shipped"] } },
        data: { status: "disputed" },
      });
      if (flipped.count === 0) {
        throw new AbortTxError("STATE", "Status pesanan berubah. Muat ulang lalu coba lagi.");
      }
      await tx.dispute.create({
        data: {
          orderId: order.id,
          ref,
          reasonId: parsed.data.reasonId,
          reasonLabel: DISPUTE_REASON_LABELS[parsed.data.reasonId] ?? parsed.data.reasonId,
          buyerNote: parsed.data.buyerNote,
          evidence: JSON.stringify(evidence),
          status: DISPUTE_OPEN_STATE,
          slaHoursLeft: 24,
        },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "disputed",
          label: `Sengketa ${ref} dibuka, dana dibekukan`,
          actor: "buyer",
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actionType: "dispute.open",
          targetResource: "orders",
          targetId: order.id,
          diffPayload: JSON.stringify({ ref, reasonId: parsed.data.reasonId }),
          ipAddress: ip,
          actor: participant.user.email,
        },
      });
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.code, err.reason);
    // Two concurrent dispute opens race on the unique ref -> the loser bounces.
    if (isUniqueCollision(err)) {
      return fail("STATE", "Sengketa untuk pesanan ini sudah terbuka.");
    }
    throw err;
  }

  revalidatePath(`/pesanan/${parsed.data.orderCode}`);
  if (order.seller) {
    await notify({
      userId: order.seller.userId,
      kind: "dispute_opened",
      title: `Sengketa ${ref} dibuka untuk ${parsed.data.orderCode}`,
      body: "Dana dibekukan. Balas dengan bukti lewat panel sengketa sebelum admin memutuskan.",
      link: `/pesanan/${parsed.data.orderCode}`,
    });
  }
  await notifyMany(await adminUserIds(), {
    kind: "dispute_opened",
    title: `Sengketa baru ${ref}`,
    body: `${parsed.data.orderCode}: ${DISPUTE_REASON_LABELS[parsed.data.reasonId] ?? parsed.data.reasonId}`,
    link: `/pesanan/${parsed.data.orderCode}`,
  });
  return { ok: true };
}

/** Seller replies to an open dispute (editable until an admin resolves it). */
export async function replyDispute(rawInput: unknown): Promise<RoomActionResult> {
  const parsed = replySchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail("INVALID", parsed.error.issues[0]?.message ?? "Balasan tidak valid.");
  }

  const participant = await loadParticipant(parsed.data.orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (!checkThrottle(`dispute-reply:${participant.user.id}`, 30000)) {
    return fail("STATE", "Terlalu cepat. Tunggu 30 detik sebelum memperbarui balasan.");
  }

  const guard = await requireSellerOfOrder(
    participant.order.id,
    participant.user.id,
    participant.user.role,
  );
  if (!guard.ok) return fail("FORBIDDEN", guard.error);

  const dispute = await db.dispute.findUnique({
    where: { orderId: participant.order.id },
    select: { id: true, ref: true, status: true },
  });
  if (!dispute) return fail("STATE", "Pesanan ini tidak dalam sengketa.");
  if (!isDecidableDispute(dispute.status)) {
    return fail("STATE", "Sengketa sudah diputus admin. Balasan dikunci.");
  }

  await db.$transaction([
    db.dispute.update({
      where: { id: dispute.id },
      data: { sellerReply: parsed.data.sellerReply, status: DISPUTE_SELLER_REPLIED_STATE },
    }),
    db.orderEvent.create({
      data: {
        orderId: participant.order.id,
        state: "disputed",
        label: "Penjual mengirim balasan sengketa",
        actor: "seller",
      },
    }),
  ]);

  await notify({
    userId: participant.order.buyerId,
    kind: "dispute_opened",
    title: `Penjual membalas sengketa ${parsed.data.orderCode}`,
    body: parsed.data.sellerReply.slice(0, 120),
    link: `/pesanan/${parsed.data.orderCode}`,
  });
  await notifyMany(await adminUserIds(), {
    kind: "dispute_opened",
    title: `Balasan sengketa ${dispute.ref}`,
    body: `${parsed.data.orderCode} siap dimediasi.`,
    link: `/pesanan/${parsed.data.orderCode}`,
  });

  revalidatePath(`/pesanan/${parsed.data.orderCode}`);
  return { ok: true };
}

async function requireSellerOfOrder(orderId: string, userId: string, role: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, sellerId: true, status: true },
  });
  if (!order) return { ok: false as const, error: "Pesanan tidak ditemukan." };
  if (!order.sellerId) return { ok: false as const, error: "Pesanan belum punya penjual." };
  const profile = await db.sellerProfile.findUnique({
    where: { id: order.sellerId },
    select: { userId: true, storeName: true },
  });
  if (profile?.userId !== userId && role !== "admin") {
    return { ok: false as const, error: "Hanya penjual pesanan ini yang bisa melakukan aksi ini." };
  }
  return { ok: true as const, order, storeName: profile?.storeName ?? "Penjual" };
}

/** Seller claims a paid order (paid → processing), assigning themselves if pool. */
export async function startOrderProcessing(orderCode: string): Promise<RoomActionResult> {
  if (!validCode(orderCode)) return fail("INVALID", "Kode pesanan tidak valid.");
  const participant = await loadParticipant(orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.status !== "paid") {
    return fail("STATE", "Pesanan belum dibayar atau sudah diproses.");
  }

  const order = await db.order.findUnique({ where: { id: participant.order.id } });
  if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.buyerId === participant.user.id) {
    return fail("FORBIDDEN", "Pembeli tidak bisa mengambil pesanan sendiri sebagai penjual.");
  }

  if (order.sellerId) {
    const guard = await requireSellerOfOrder(order.id, participant.user.id, participant.user.role);
    if (!guard.ok) return fail("FORBIDDEN", guard.error);
    // Guarded flip: a concurrent dispute (paid → disputed) wins the race and
    // this claim cleanly loses instead of resurrecting the order.
    const claimed = await db.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "paid" },
        data: { status: "processing" },
      });
      if (updated.count === 0) return "taken" as const;
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "processing",
          label: "Penjual mulai memproses pesanan",
          actor: "seller",
        },
      });
      await tx.message.create({
        data: {
          orderId: order.id,
          fromRole: "system",
          body: `Penjual ${guard.storeName} mulai memproses pesanan.`,
        },
      });
      return "done" as const;
    });
    if (claimed === "taken") {
      return fail("STATE", "Status pesanan berubah (mis. disengketakan). Muat ulang.");
    }
  } else {
    const profile = await db.sellerProfile.findFirst({
      where: { userId: participant.user.id },
      select: { id: true, storeName: true, kycVerified: true },
    });
    if (!profile) return fail("FORBIDDEN", "Akun ini bukan penjual.");
    if (!profile.kycVerified) {
      return fail("FORBIDDEN", "KYC belum terverifikasi. Rebutan pool baru terbuka setelah KYC disetujui.");
    }

    // Race-safe pool claim: only one seller can flip paid → processing on an
    // unassigned order. Everyone else loses the updateMany guard.
    const state = await db.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: order.id, status: "paid", sellerId: null },
        data: { status: "processing", sellerId: profile.id, isPoolOrder: false },
      });
      if (claimed.count === 0) return "taken" as const;
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "processing",
          label: "Penjual mengambil dan mulai memproses",
          actor: "seller",
        },
      });
      await tx.message.create({
        data: {
          orderId: order.id,
          fromRole: "system",
          body: `Penjual ${profile.storeName} mengambil pesanan ini dan mulai memproses.`,
        },
      });
      return "done" as const;
    });
    if (state === "taken") {
      // Lost the race — but it might have been against ourselves (double
      // click): re-read, and treat "already mine" as success.
      const fresh = await db.order.findUnique({
        where: { id: order.id },
        select: { sellerId: true },
      });
      if (fresh?.sellerId === profile.id) {
        revalidatePath(`/pesanan/${orderCode}`);
        revalidatePath("/dashboard/penjual/order-robux");
        revalidatePath("/dashboard/penjual");
        return { ok: true };
      }
      return fail("STATE", "Keburu diambil penjual lain. Muat ulang untuk melihat pool terbaru.");
    }
    await notify({
      userId: order.buyerId,
      kind: "order_processing",
      title: `${profile.storeName} mengambil pesananmu`,
      body: `${orderCode} mulai diproses. Pantau progres di ruang pesanan.`,
      link: `/pesanan/${orderCode}`,
    });
  }

  if (order.sellerId) {
    await notify({
      userId: order.buyerId,
      kind: "order_processing",
      title: `Pesananmu mulai diproses`,
      body: `${orderCode} sedang dikerjakan penjual. Pantau progres di ruang pesanan.`,
      link: `/pesanan/${orderCode}`,
    });
  }

  revalidatePath(`/pesanan/${orderCode}`);
  revalidatePath("/dashboard/penjual/order-robux");
  revalidatePath("/dashboard/penjual");
  return { ok: true };
}

/** Seller marks the order as shipped (processing → shipped). */
export async function markOrderShipped(orderCode: string): Promise<RoomActionResult> {
  if (!validCode(orderCode)) return fail("INVALID", "Kode pesanan tidak valid.");
  const participant = await loadParticipant(orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.status !== "processing") {
    return fail("STATE", "Pesanan belum diproses.");
  }

  const guard = await requireSellerOfOrder(
    participant.order.id,
    participant.user.id,
    participant.user.role,
  );
  if (!guard.ok) return fail("FORBIDDEN", guard.error);

  const order = guard.order;
  const full = await db.order.findUnique({
    where: { id: order.id },
    select: { productId: true, quantity: true },
  });
  const product =
    full?.productId != null
      ? await db.product.findUnique({
          where: { id: full.productId },
          select: { autoReleaseHours: true },
        })
      : null;
  // The confirm window starts at delivery, not at payment.
  const autoReleaseAt = new Date(Date.now() + (product?.autoReleaseHours ?? 24) * 3_600_000);
  // Guarded flip: a concurrent AFK-cancel (processing → refunded) wins the
  // race and this shipment cleanly loses instead of resurrecting the order.
  const shipped = await db.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: "processing" },
      data: { status: "shipped", autoReleaseAt },
    });
    if (updated.count === 0) return "taken" as const;
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        state: "shipped",
        label: "Penjual menandai barang terkirim",
        actor: "seller",
      },
    });
    await tx.message.create({
      data: {
        orderId: order.id,
        fromRole: "system",
        body: `Penjual ${guard.storeName} menandai barang terkirim. Konfirmasi penerimaan setelah barang kamu terima, ya.`,
      },
    });
    if (full?.productId) {
      await tx.product.update({
        where: { id: full.productId },
        data: { sold: { increment: full.quantity } },
      });
    }
    return "done" as const;
  });
  if (shipped === "taken") {
    return fail("STATE", "Status pesanan berubah (mis. dibatalkan pembeli). Muat ulang.");
  }

  await notify({
    userId: participant.order.buyerId,
    kind: "order_shipped",
    title: `Pesananmu dikirim`,
    body: `${orderCode} ditandai terkirim. Cek barangnya lalu konfirmasi penerimaan.`,
    link: `/pesanan/${orderCode}`,
  });

  revalidatePath(`/pesanan/${orderCode}`);
  return { ok: true };
}

/** Buyer reveals the full credentials once (audited). */
export async function revealOrderCredentials(orderCode: string): Promise<
  | { ok: true; password: string; parentalPin: string; twoFactorBackupCodes: string }
  | { ok: false; error: string }
> {
  if (!validCode(orderCode)) return { ok: false, error: "Kode pesanan tidak valid." };

  const participant = await loadParticipant(orderCode);
  if (!participant) return { ok: false, error: "Pesanan tidak ditemukan." };
  if (participant.order.buyerId !== participant.user.id) {
    return { ok: false, error: "Hanya pembeli yang bisa melihat kredensial." };
  }

  const order = await db.order.findUnique({
    where: { id: participant.order.id },
    select: { id: true, status: true, credentialsEnc: true, code: true },
  });
  if (!order?.credentialsEnc) return { ok: false, error: "Pesanan ini tidak punya kredensial." };
  // The handover is void once money is back or the order died — and there is
  // nothing to reveal before the seller starts working.
  if (!["paid", "processing", "shipped", "completed", "disputed"].includes(order.status)) {
    return { ok: false, error: "Kredensial tidak tersedia untuk status pesanan ini." };
  }

  let password = "";
  let parentalPin = "";
  let twoFactorBackupCodes = "";
  try {
    const decrypted = decryptCredentials(order.credentialsEnc);
    password = decrypted.password ?? "";
    parentalPin = decrypted.parentalPin ?? "";
    twoFactorBackupCodes = decrypted.twoFactorBackupCodes ?? "";
  } catch {
    return { ok: false, error: "Gagal mendekripsi kredensial." };
  }

  await db.adminAuditLog.create({
    data: {
      actionType: "credential.decrypt",
      targetResource: "credentials",
      targetId: order.id,
      diffPayload: JSON.stringify({ orderCode: order.code }),
      ipAddress: await clientIp(),
      actor: participant.user.email,
    },
  });

  return { ok: true, password, parentalPin, twoFactorBackupCodes };
}

const reviewSchema = z.object({
  orderCode: z.string().regex(CODE_PATTERN),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

/** Buyer rates a completed order (once). Recomputes the seller's public rating. */
export async function submitReview(rawInput: unknown): Promise<RoomActionResult> {
  const parsed = reviewSchema.safeParse(rawInput);
  if (!parsed.success) return fail("INVALID", "Ulasan tidak valid.");
  const { orderCode, rating } = parsed.data;
  const comment = parsed.data.comment?.trim() ?? "";

  const participant = await loadParticipant(orderCode);
  if (!participant) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (participant.order.buyerId !== participant.user.id) {
    return fail("FORBIDDEN", "Hanya pembeli yang bisa memberi ulasan.");
  }

  const order = await db.order.findUnique({
    where: { id: participant.order.id },
    select: { id: true, status: true, productId: true, sellerId: true },
  });
  if (!order) return fail("NOT_FOUND", "Pesanan tidak ditemukan.");
  if (order.status !== "completed") {
    return fail("STATE", "Ulasan hanya bisa diberikan setelah pesanan selesai.");
  }

  try {
    await db.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { orderId: order.id },
        select: { id: true },
      });
      if (existing) {
        throw new AbortTxError("STATE", "Pesanan ini sudah pernah diulas.");
      }

      await tx.review.create({
        data: {
          orderId: order.id,
          productId: order.productId,
          sellerId: order.sellerId,
          buyerId: participant.user.id,
          rating,
          comment,
        },
      });

      if (order.sellerId) {
        const agg = await tx.review.aggregate({
          where: { sellerId: order.sellerId, hidden: false },
          _avg: { rating: true },
          _count: true,
        });
        await tx.sellerProfile.update({
          where: { id: order.sellerId },
          data: {
            rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
            reviewCount: agg._count,
          },
        });
      }
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.code, err.reason);
    if (isUniqueCollision(err)) return fail("STATE", "Pesanan ini sudah pernah diulas.");
    throw err;
  }

  revalidatePath(`/pesanan/${orderCode}`);
  if (order.productId) {
    const product = await db.product.findUnique({
      where: { id: order.productId },
      select: { slug: true },
    });
    if (product) revalidatePath(`/produk/${product.slug}`);
  }
  revalidatePath("/dashboard/penjual");
  if (order.sellerId) {
    const profile = await db.sellerProfile.findUnique({
      where: { id: order.sellerId },
      select: { userId: true },
    });
    if (profile) {
      await notify({
        userId: profile.userId,
        kind: "review_received",
        title: `Ulasan baru ${"★".repeat(rating)} untuk ${orderCode}`,
        body: comment || "Pembeli memberi bintang tanpa komentar.",
        link: `/pesanan/${orderCode}`,
      });
    }
  }
  return { ok: true };
}
