import "server-only";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { expireStaleTopUps } from "@/lib/topup";
import { notify } from "@/lib/notifications";

const AUTO_RELEASE_BATCH = 20;
const EXPIRE_BATCH = 20;
const REFUND_BATCH = 20;

export interface SweepResult {
  released: string[];
  expired: string[];
  refundedPool: string[];
  refundedStuck: string[];
  refundedIdle: string[];
  expiredTopUps: string[];
  wipedCreds: number;
  reminded: number;
}

export interface SweepTimeouts {
  /** hours a paid pool order may sit unclaimed before the buyer is refunded */
  poolHours: number;
  /** days a processing order may sit untouched before the buyer is refunded */
  processingDays: number;
  /** hours a paid ASSIGNED order may sit unstarted before the buyer is refunded */
  assignedHours: number;
}

/// Exported so the policy pages can state the same windows the sweep actually
/// enforces, instead of a number typed twice and left to drift.
export const DEFAULT_TIMEOUTS: SweepTimeouts = { poolHours: 24, processingDays: 7, assignedHours: 72 };

/// How long a completed order keeps the credentials the buyer handed over.
/// Exported for the same reason as the windows above: the promise "dihapus
/// permanen N hari setelah selesai" is made to buyers on several surfaces, and
/// a number typed once per surface is a number that drifts.
export const CREDENTIAL_WIPE_DAYS = 7;

/** How far before a deadline the system reminder lands. */
const RELEASE_REMINDER_WINDOW_MS = 2 * 3_600_000;
const POOL_REMINDER_WINDOW_MS = 2 * 3_600_000;
const SELLER_REMINDER_WINDOW_MS = 3 * 3_600_000;

/// Reminder messages are deduped by these prefixes: the sweep reads back the
/// message list for the marker, so overlapping passes can post each reminder
/// exactly once. The prefix doubles as readable copy in the chat timeline.
const RELEASE_REMINDER_MARKER = "Pengingat: pesanan otomatis selesai";
const SELLER_REMINDER_MARKER = "Pengingat: pesanan otomatis dibatalkan";
const POOL_REMINDER_MARKER = "Pengingat: belum ada penjual";

/** Sweep windows, tunable via the `sweep.timeouts` setting row. */
export async function getSweepTimeouts(): Promise<SweepTimeouts> {
  const row = await db.setting.findUnique({ where: { key: "sweep.timeouts" } });
  if (!row) return DEFAULT_TIMEOUTS;
  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const poolHours = Number(parsed.poolHours);
    const processingDays = Number(parsed.processingDays);
    const assignedHours = Number(parsed.assignedHours);
    return {
      poolHours: Number.isFinite(poolHours) && poolHours > 0 ? poolHours : DEFAULT_TIMEOUTS.poolHours,
      processingDays:
        Number.isFinite(processingDays) && processingDays > 0
          ? processingDays
          : DEFAULT_TIMEOUTS.processingDays,
      assignedHours:
        Number.isFinite(assignedHours) && assignedHours > 0
          ? assignedHours
          : DEFAULT_TIMEOUTS.assignedHours,
    };
  } catch {
    return DEFAULT_TIMEOUTS;
  }
}

class SkipOrder extends Error {}

function isUniqueCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

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

/** Release shipped orders whose confirm window elapsed — same payout as the
 *  buyer's "confirm received", guarded so a retry can never double-pay. */
async function releaseDueOrders(now: Date): Promise<string[]> {
  const due = await db.order.findMany({
    where: { status: "shipped", autoReleaseAt: { lte: now } },
    select: {
      id: true,
      code: true,
      total: true,
      platformFee: true,
      seller: { select: { id: true, userId: true } },
    },
    take: AUTO_RELEASE_BATCH,
  });

  const released: string[] = [];
  for (const order of due) {
    if (!order.seller) continue;
    const earning = order.total - order.platformFee;
    try {
      await db.$transaction(async (tx) => {
        const alreadyPaid = await tx.walletLedger.findFirst({
          where: { orderCode: order.code, type: "earning" },
          select: { id: true },
        });
        if (alreadyPaid) throw new SkipOrder();

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "shipped" },
          data: { status: "completed", autoReleaseAt: null },
        });
        if (updated.count === 0) throw new SkipOrder();

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "completed",
            label: "Jendela konfirmasi habis, dana dilepas ke penjual",
            actor: "system",
          },
        });
        await tx.message.create({
          data: {
            orderId: order.id,
            fromRole: "system",
            body: "Jendela konfirmasi habis. Dana otomatis diteruskan ke penjual. Pesanan selesai.",
          },
        });
        await tx.sellerProfile.update({
          where: { id: order.seller!.id },
          data: { ordersCompleted: { increment: 1 } },
        });
        await appendLedger(tx, {
          userId: order.seller!.userId,
          sellerId: order.seller!.id,
          type: "earning",
          amount: earning,
          note: `Auto-release pesanan ${order.code}`,
          orderCode: order.code,
        });
      });
      released.push(order.code);
      await notify({
        userId: order.seller!.userId,
        kind: "order_completed",
        title: `Dana ${order.code} cair otomatis`,
        body: "Jendela konfirmasi habis. Dana dilepas ke dompetmu.",
        link: `/pesanan/${order.code}`,
      });
    } catch (err) {
      if (err instanceof SkipOrder || isUniqueCollision(err)) continue;
      // Isolate: one poison order must never abort the rest of the batch.
      // It stays visible in PM2 logs for a human to inspect.
      console.error("sweep releaseDueOrders failed", order.code, err);
      continue;
    }
  }
  return released;
}

/** Cancel pending-payment orders whose billing window elapsed, restoring stock. */
async function expireStalePayments(now: Date): Promise<string[]> {
  const stale = await db.order.findMany({
    where: {
      status: "pending_payment",
      payment: { status: "pending", expiresAt: { lte: now } },
    },
    select: {
      id: true,
      code: true,
      buyerId: true,
      productId: true,
      quantity: true,
      promoCode: true,
      payment: { select: { id: true } },
    },
    take: EXPIRE_BATCH,
  });

  const expired: string[] = [];
  for (const order of stale) {
    if (!order.payment) continue;
    try {
      // Interactive tx: the guarded update runs FIRST so a concurrent
      // settlement (count === 0) rolls everything back — no phantom stock
      // restore, no stray cancelled event.
      await db.$transaction(async (tx) => {
        const cancelled = await tx.order.updateMany({
          where: { id: order.id, status: "pending_payment" },
          data: { status: "cancelled" },
        });
        if (cancelled.count === 0) throw new SkipOrder();
        await tx.payment.updateMany({
          where: { id: order.payment!.id, status: "pending" },
          data: { status: "expired" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "cancelled",
            label: "Jendela pembayaran habis, pesanan dibatalkan otomatis",
            actor: "system",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
        }
        // Release the promo redemption: the buyer never completed this
        // invoice, so a limited code must not lose a slot to the expiry.
        if (order.promoCode) {
          await tx.promoCode.updateMany({
            where: { code: order.promoCode, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      });
      expired.push(order.code);
      await notify({
        userId: order.buyerId,
        kind: "order_cancelled",
        title: `Pesanan ${order.code} kedaluwarsa`,
        body: "Jendela pembayaran habis. Pesanan dibatalkan otomatis.",
        link: `/pesanan/${order.code}`,
      });
    } catch (err) {
      if (err instanceof SkipOrder) continue;
      console.error("sweep expireStalePayments failed", order.code, err);
      continue;
    }
  }
  return expired;
}

/** One sweep pass: auto-release + payment expiry. Safe to call concurrently —
 *  every mutation is status-guarded, so overlap just no-ops. */
export async function runSweep(): Promise<SweepResult> {
  const now = new Date();
  const timeouts = await getSweepTimeouts();
  const [
    released,
    expired,
    refundedPool,
    refundedStuck,
    refundedIdle,
    expiredTopUps,
    wipedCreds,
    reminded,
  ] = await Promise.all([
    releaseDueOrders(now),
    expireStalePayments(now),
    refundStalePoolOrders(now, timeouts.poolHours),
    refundStuckProcessingOrders(now, timeouts.processingDays),
    refundIdleAssignedOrders(now, timeouts.assignedHours),
    expireStaleTopUps(),
    wipeOldCredentials(now),
    sendDeadlineReminders(now, timeouts),
  ]);
  if (expired.length > 0) revalidateTag("catalog", { expire: 0 });
  return {
    released,
    expired,
    refundedPool,
    refundedStuck,
    refundedIdle,
    expiredTopUps,
    wipedCreds,
    reminded,
  };
}

/**
 * Credentials promised "dihapus permanen 7 hari setelah selesai": null the
 * encrypted blob on completed orders past the window. Reveal calls after that
 * fail cleanly with "tidak punya kredensial".
 */
async function wipeOldCredentials(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - CREDENTIAL_WIPE_DAYS * 24 * 3_600_000);
  const result = await db.order.updateMany({
    // Any terminal state, not just `completed`: a refunded/cancelled order
    // must not keep an encrypted Roblox password/PIN around forever.
    where: {
      status: { in: ["completed", "refunded", "cancelled"] },
      updatedAt: { lte: cutoff },
      credentialsEnc: { not: null },
    },
    data: { credentialsEnc: null },
  });
  return result.count;
}

/**
 * Refund paid pool orders nobody claimed within the window. No seller ever
 * engaged, so the buyer's money must not sit locked forever — it returns as
 * wallet credit they can spend immediately.
 */
async function refundStalePoolOrders(now: Date, poolHours: number): Promise<string[]> {
  const cutoff = new Date(now.getTime() - poolHours * 3_600_000);
  // Cutoff lives in the WHERE + ORDER BY asc, not a post-fetch JS filter:
  // with `take: 20` and no ordering, a batch of 20 *fresh* paid orders would
  // fill every pass and the older refundable ones would never be selected —
  // escrow locked forever. Oldest-first guarantees progress.
  const stale = await db.order.findMany({
    where: {
      status: "paid",
      sellerId: null,
      isPoolOrder: true,
      createdAt: { lte: cutoff },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      total: true,
      buyerId: true,
      productId: true,
      quantity: true,
      createdAt: true,
      events: {
        where: { state: "paid" },
        orderBy: { at: "asc" },
        take: 1,
        select: { at: true },
      },
    },
    take: REFUND_BATCH,
  });

  const refunded: string[] = [];
  for (const order of stale) {
    const paidAt = order.events[0]?.at ?? order.createdAt;
    if (paidAt > cutoff) continue;
    try {
      await db.$transaction(async (tx) => {
        const alreadyRefunded = await tx.walletLedger.findFirst({
          where: { orderCode: order.code, type: "refund" },
          select: { id: true },
        });
        if (alreadyRefunded) throw new SkipOrder();

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "paid", sellerId: null },
          data: { status: "refunded", autoReleaseAt: null },
        });
        if (updated.count === 0) throw new SkipOrder();

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "refunded",
            label: "Tidak ada penjual yang mengambil, dana dikembalikan sebagai saldo",
            actor: "system",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
        }
        await appendLedger(tx, {
          userId: order.buyerId,
          type: "refund",
          amount: order.total,
          note: `Refund otomatis pesanan ${order.code} (tak diklaim penjual)`,
          orderCode: order.code,
        });
      });
      refunded.push(order.code);
      await notify({
        userId: order.buyerId,
        kind: "pool_refunded",
        title: `Dana ${order.code} dikembalikan`,
        body: "Tak ada penjual yang mengambil. Dana kembali sebagai saldo akun.",
        link: `/pesanan/${order.code}`,
      });
    } catch (err) {
      if (err instanceof SkipOrder || isUniqueCollision(err)) continue;
      console.error("sweep refundStalePoolOrders failed", order.code, err);
      continue;
    }
  }
  return refunded;
}

/**
 * Last-resort insurance for `processing` orders abandoned by their seller.
 * The window is deliberately long (days, not minutes) because legitimate
 * deliveries — e.g. gamepass pending windows — can take a while. Buyer
 * AFK-cancel and disputes remain the fast paths; this only fires when
 * neither party acted at all.
 */
async function refundStuckProcessingOrders(now: Date, processingDays: number): Promise<string[]> {
  const cutoff = new Date(now.getTime() - processingDays * 24 * 3_600_000);
  // Oldest-first + date cutoff in the query (see refundStalePoolOrders): the
  // batch must always hold the orders most likely to be refundable.
  const stuck = await db.order.findMany({
    where: { status: "processing", dispute: { is: null }, createdAt: { lte: cutoff } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      total: true,
      buyerId: true,
      productId: true,
      quantity: true,
      createdAt: true,
      seller: { select: { id: true, userId: true } },
      events: {
        where: { state: "processing" },
        orderBy: { at: "asc" },
        take: 1,
        select: { at: true },
      },
    },
    take: REFUND_BATCH,
  });

  const refunded: string[] = [];
  for (const order of stuck) {
    const processingAt = order.events[0]?.at ?? order.createdAt;
    if (processingAt > cutoff) continue;
    try {
      await db.$transaction(async (tx) => {
        const alreadyRefunded = await tx.walletLedger.findFirst({
          where: { orderCode: order.code, type: "refund" },
          select: { id: true },
        });
        if (alreadyRefunded) throw new SkipOrder();

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "processing" },
          data: { status: "refunded", autoReleaseAt: null },
        });
        if (updated.count === 0) throw new SkipOrder();

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "refunded",
            label: "Penjual tidak menyelesaikan, dana dikembalikan sebagai saldo",
            actor: "system",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
        }
        await appendLedger(tx, {
          userId: order.buyerId,
          type: "refund",
          amount: order.total,
          note: `Refund otomatis pesanan ${order.code} (penjual tidak menyelesaikan)`,
          orderCode: order.code,
        });
      });
      refunded.push(order.code);
      await notify({
        userId: order.buyerId,
        kind: "order_refunded",
        title: `Dana ${order.code} dikembalikan`,
        body: "Penjual tidak menyelesaikan pesanan. Dana kembali sebagai saldo akun.",
        link: `/pesanan/${order.code}`,
      });
      if (order.seller) {
        await notify({
          userId: order.seller.userId,
          kind: "order_refunded",
          title: `${order.code} direfund otomatis`,
          body: "Pesanan terlalu lama diproses. Dana dikembalikan ke pembeli.",
          link: `/pesanan/${order.code}`,
        });
      }
    } catch (err) {
      if (err instanceof SkipOrder || isUniqueCollision(err)) continue;
      console.error("sweep refundStuckProcessingOrders failed", order.code, err);
      continue;
    }
  }
  if (refunded.length > 0) revalidateTag("catalog", { expire: 0 });
  return refunded;
}

/**
 * Refund paid ASSIGNED orders the seller never started. Neither the pool
 * refund (unassigned only) nor the stuck-processing refund (processing
 * only) covers them — without this, escrow locks forever when a seller
 * goes silent right after payment.
 */
async function refundIdleAssignedOrders(now: Date, assignedHours: number): Promise<string[]> {
  const cutoff = new Date(now.getTime() - assignedHours * 3_600_000);
  // Oldest-first + date cutoff in the query (see refundStalePoolOrders).
  const idle = await db.order.findMany({
    where: { status: "paid", sellerId: { not: null }, createdAt: { lte: cutoff } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      total: true,
      buyerId: true,
      productId: true,
      quantity: true,
      createdAt: true,
      seller: { select: { id: true, userId: true } },
      events: {
        where: { state: "paid" },
        orderBy: { at: "asc" },
        take: 1,
        select: { at: true },
      },
    },
    take: REFUND_BATCH,
  });

  const refunded: string[] = [];
  for (const order of idle) {
    const paidAt = order.events[0]?.at ?? order.createdAt;
    if (paidAt > cutoff) continue;
    try {
      await db.$transaction(async (tx) => {
        const alreadyRefunded = await tx.walletLedger.findFirst({
          where: { orderCode: order.code, type: "refund" },
          select: { id: true },
        });
        if (alreadyRefunded) throw new SkipOrder();

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "paid", sellerId: { not: null } },
          data: { status: "refunded", autoReleaseAt: null },
        });
        if (updated.count === 0) throw new SkipOrder();

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "refunded",
            label: "Penjual tidak kunjung memulai, dana dikembalikan sebagai saldo",
            actor: "system",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
        }
        await appendLedger(tx, {
          userId: order.buyerId,
          type: "refund",
          amount: order.total,
          note: `Refund otomatis pesanan ${order.code} (penjual tidak memulai)`,
          orderCode: order.code,
        });
      });
      refunded.push(order.code);
      await notify({
        userId: order.buyerId,
        kind: "order_refunded",
        title: `Dana ${order.code} dikembalikan`,
        body: "Penjual tidak memulai pesanan. Dana kembali sebagai saldo akun.",
        link: `/pesanan/${order.code}`,
      });
      if (order.seller) {
        await notify({
          userId: order.seller.userId,
          kind: "order_refunded",
          title: `${order.code} direfund otomatis`,
          body: "Pesanan tidak dimulai tepat waktu. Dana dikembalikan ke pembeli.",
          link: `/pesanan/${order.code}`,
        });
      }
    } catch (err) {
      if (err instanceof SkipOrder || isUniqueCollision(err)) continue;
      console.error("sweep refundIdleAssignedOrders failed", order.code, err);
      continue;
    }
  }
  if (refunded.length > 0) revalidateTag("catalog", { expire: 0 });
  return refunded;
}

/** Reminders land in "±2 jam" style copy; the sweep runs every 10 minutes,
 *  so rounding to whole hours keeps the message honest. */
function hoursLeft(deadlineMs: number, now: Date): number {
  return Math.max(1, Math.round((deadlineMs - now.getTime()) / 3_600_000));
}

/**
 * Gentle heads-up before the sweep moves money on its own: the buyer gets one
 * reminder before auto-release, the seller one before an idle assigned order
 * refunds, and the buyer one before an unclaimed pool order returns their
 * balance. Each lands as a marker-prefixed system message (deduped by reading
 * the marker back) plus a notification, so the deadline shows up exactly
 * where the person can still act on it.
 */
async function sendDeadlineReminders(now: Date, timeouts: SweepTimeouts): Promise<number> {
  let sent = 0;

  const post = async (
    orderId: string,
    marker: string,
    body: string,
    recipient: { userId: string; title: string; notification: string; code: string },
  ): Promise<void> => {
    const existing = await db.message.findFirst({
      where: { orderId, fromRole: "system", body: { startsWith: marker } },
      select: { id: true },
    });
    if (existing) return;
    await db.message.create({ data: { orderId, fromRole: "system", body } });
    await notify({
      userId: recipient.userId,
      kind: "order_reminder",
      title: recipient.title,
      body: recipient.notification,
      link: `/pesanan/${recipient.code}`,
    });
    sent += 1;
  };

  // 1. Buyer: the auto-release window on a shipped order is closing.
  const releaseCutoff = new Date(now.getTime() + RELEASE_REMINDER_WINDOW_MS);
  const releasing = await db.order.findMany({
    where: {
      status: "shipped",
      dispute: { is: null },
      autoReleaseAt: { gt: now, lte: releaseCutoff },
    },
    orderBy: { autoReleaseAt: "asc" },
    select: { id: true, code: true, buyerId: true, autoReleaseAt: true },
    take: REFUND_BATCH,
  });
  for (const order of releasing) {
    if (!order.autoReleaseAt) continue;
    try {
      const hours = hoursLeft(order.autoReleaseAt.getTime(), now);
      await post(
        order.id,
        RELEASE_REMINDER_MARKER,
        `${RELEASE_REMINDER_MARKER} dan dana dilepas ke penjual dalam ±${hours} jam bila kamu tidak konfirmasi terima.`,
        {
          userId: order.buyerId,
          code: order.code,
          title: `Konfirmasi ${order.code} sebelum dana dilepas`,
          notification: `Jendela konfirmasi tersisa ±${hours} jam. Buka pesanan untuk konfirmasi terima atau ajukan komplain.`,
        },
      );
    } catch (err) {
      console.error("sweep sendDeadlineReminders (release) failed", order.code, err);
    }
  }

  // 2. Seller: an assigned order they never started is about to refund.
  const assignedMs = timeouts.assignedHours * 3_600_000;
  const idleFrom = new Date(now.getTime() + SELLER_REMINDER_WINDOW_MS - assignedMs);
  const idleTo = new Date(now.getTime() - assignedMs);
  const idling = await db.order.findMany({
    where: {
      status: "paid",
      sellerId: { not: null },
      dispute: { is: null },
      createdAt: { gt: idleTo, lte: idleFrom },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      createdAt: true,
      seller: { select: { userId: true } },
      events: {
        where: { state: "paid" },
        orderBy: { at: "asc" },
        take: 1,
        select: { at: true },
      },
    },
    take: REFUND_BATCH,
  });
  for (const order of idling) {
    if (!order.seller) continue;
    const paidAt = order.events[0]?.at ?? order.createdAt;
    const left = paidAt.getTime() + assignedMs - now.getTime();
    if (left <= 0 || left > SELLER_REMINDER_WINDOW_MS) continue;
    try {
      const hours = hoursLeft(paidAt.getTime() + assignedMs, now);
      await post(
        order.id,
        SELLER_REMINDER_MARKER,
        `${SELLER_REMINDER_MARKER} dan dana kembali ke pembeli dalam ±${hours} jam bila kamu belum mulai memproses.`,
        {
          userId: order.seller.userId,
          code: order.code,
          title: `Segera mulai ${order.code}`,
          notification: `Sisa ±${hours} jam sebelum pesanan direfund otomatis. Buka pesanan dan mulai proses agar tidak hangus.`,
        },
      );
    } catch (err) {
      console.error("sweep sendDeadlineReminders (seller) failed", order.code, err);
    }
  }

  // 3. Buyer: a pool order nobody claimed is about to return their balance.
  const poolMs = timeouts.poolHours * 3_600_000;
  const poolFrom = new Date(now.getTime() + POOL_REMINDER_WINDOW_MS - poolMs);
  const poolTo = new Date(now.getTime() - poolMs);
  const unclaimed = await db.order.findMany({
    where: {
      status: "paid",
      sellerId: null,
      isPoolOrder: true,
      dispute: { is: null },
      createdAt: { gt: poolTo, lte: poolFrom },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      code: true,
      buyerId: true,
      createdAt: true,
      events: {
        where: { state: "paid" },
        orderBy: { at: "asc" },
        take: 1,
        select: { at: true },
      },
    },
    take: REFUND_BATCH,
  });
  for (const order of unclaimed) {
    const paidAt = order.events[0]?.at ?? order.createdAt;
    const left = paidAt.getTime() + poolMs - now.getTime();
    if (left <= 0 || left > POOL_REMINDER_WINDOW_MS) continue;
    try {
      const hours = hoursLeft(paidAt.getTime() + poolMs, now);
      await post(
        order.id,
        POOL_REMINDER_MARKER,
        `${POOL_REMINDER_MARKER} mengambil pesanan ini; dana otomatis kembali ke saldo dalam ±${hours} jam.`,
        {
          userId: order.buyerId,
          code: order.code,
          title: `${order.code} belum diambil penjual`,
          notification: `Sisa ±${hours} jam sebelum danamu kembali otomatis sebagai saldo.`,
        },
      );
    } catch (err) {
      console.error("sweep sendDeadlineReminders (pool) failed", order.code, err);
    }
  }

  return sent;
}
