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
}

export interface SweepTimeouts {
  /** hours a paid pool order may sit unclaimed before the buyer is refunded */
  poolHours: number;
  /** days a processing order may sit untouched before the buyer is refunded */
  processingDays: number;
  /** hours a paid ASSIGNED order may sit unstarted before the buyer is refunded */
  assignedHours: number;
}

const DEFAULT_TIMEOUTS: SweepTimeouts = { poolHours: 24, processingDays: 7, assignedHours: 72 };

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
            label: "Auto-release — jendela konfirmasi habis, dana dilepas ke penjual",
            actor: "system",
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
        body: "Jendela konfirmasi habis — dana dilepas ke dompetmu.",
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
            label: "Jendela pembayaran habis — pesanan dibatalkan otomatis",
            actor: "system",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
        }
      });
      expired.push(order.code);
      await notify({
        userId: order.buyerId,
        kind: "order_cancelled",
        title: `Pesanan ${order.code} kedaluwarsa`,
        body: "Jendela pembayaran habis — pesanan dibatalkan otomatis.",
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
  const [released, expired, refundedPool, refundedStuck, refundedIdle, expiredTopUps, wipedCreds] =
    await Promise.all([
      releaseDueOrders(now),
      expireStalePayments(now),
      refundStalePoolOrders(now, timeouts.poolHours),
      refundStuckProcessingOrders(now, timeouts.processingDays),
      refundIdleAssignedOrders(now, timeouts.assignedHours),
      expireStaleTopUps(),
      wipeOldCredentials(now),
    ]);
  if (expired.length > 0) revalidateTag("catalog", { expire: 0 });
  return { released, expired, refundedPool, refundedStuck, refundedIdle, expiredTopUps, wipedCreds };
}

/**
 * Credentials promised "dihapus permanen 7 hari setelah selesai": null the
 * encrypted blob on completed orders past the window. Reveal calls after that
 * fail cleanly with "tidak punya kredensial".
 */
async function wipeOldCredentials(now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - 7 * 24 * 3_600_000);
  const result = await db.order.updateMany({
    where: {
      status: "completed",
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
  const stale = await db.order.findMany({
    where: { status: "paid", sellerId: null, isPoolOrder: true },
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
            label: "Tidak ada penjual yang mengambil — dana dikembalikan sebagai saldo",
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
        body: "Tak ada penjual yang mengambil — dana kembali sebagai saldo akun.",
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
  const stuck = await db.order.findMany({
    where: { status: "processing", dispute: { is: null } },
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
            label: "Penjual tidak menyelesaikan — dana dikembalikan sebagai saldo",
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
        body: "Penjual tidak menyelesaikan pesanan — dana kembali sebagai saldo akun.",
        link: `/pesanan/${order.code}`,
      });
      if (order.seller) {
        await notify({
          userId: order.seller.userId,
          kind: "order_refunded",
          title: `${order.code} direfund otomatis`,
          body: "Pesanan terlalu lama diproses — dana dikembalikan ke pembeli.",
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
  const idle = await db.order.findMany({
    where: { status: "paid", sellerId: { not: null } },
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
            label: "Penjual tidak kunjung memulai — dana dikembalikan sebagai saldo",
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
        body: "Penjual tidak memulai pesanan — dana kembali sebagai saldo akun.",
        link: `/pesanan/${order.code}`,
      });
      if (order.seller) {
        await notify({
          userId: order.seller.userId,
          kind: "order_refunded",
          title: `${order.code} direfund otomatis`,
          body: "Pesanan tidak dimulai tepat waktu — dana dikembalikan ke pembeli.",
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
