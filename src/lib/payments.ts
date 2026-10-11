import "server-only";
import { randomBytes } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { broadcastPoolOrder, poolKindLabel } from "@/lib/discord";
import { notify } from "@/lib/notifications";

/** Buyer-facing payment methods. Fees default to the seeded settings values. */
export type PaymentMethodId = "qris" | "va" | "ewallet" | "saldo";

export const PAYMENT_METHODS: ReadonlyArray<{
  id: PaymentMethodId;
  label: string;
  detail: string;
  defaultFee: number;
}> = [
  { id: "qris", label: "QRIS", detail: "Semua e-wallet & m-banking", defaultFee: 0 },
  { id: "va", label: "Virtual Account", detail: "BCA · BNI · Mandiri · BRI", defaultFee: 4_000 },
  { id: "ewallet", label: "E-Wallet", detail: "GoPay · OVO · DANA", defaultFee: 2_500 },
  { id: "saldo", label: "Saldo Akun", detail: "Potong langsung dari dompet Blox Astra", defaultFee: 0 },
];

const DEFAULT_FEES: Record<PaymentMethodId, number> = { qris: 0, va: 4_000, ewallet: 2_500, saldo: 0 };

/** Payment method fees in rupiah, read from the seeded `payment.fees` setting. */
export async function getPaymentFees(): Promise<Record<PaymentMethodId, number>> {
  const row = await db.setting.findUnique({ where: { key: "payment.fees" } });
  if (!row) return DEFAULT_FEES;
  try {
    const parsed = JSON.parse(row.value) as Record<string, unknown>;
    const qris = Number(parsed.qris);
    const va = Number(parsed.va);
    const ewallet = Number(parsed.ewallet);
    return {
      qris: Number.isFinite(qris) && qris >= 0 ? qris : DEFAULT_FEES.qris,
      va: Number.isFinite(va) && va >= 0 ? va : DEFAULT_FEES.va,
      ewallet: Number.isFinite(ewallet) && ewallet >= 0 ? ewallet : DEFAULT_FEES.ewallet,
      // Wallet-balance payments never carry a gateway fee.
      saldo: 0,
    };
  } catch {
    return DEFAULT_FEES;
  }
}

/** Human-facing order code: "BX-" + 6 unambiguous base36 chars. */
export function generateOrderCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `BX-${out}`;
}

/** Discount in rupiah for a promo code, or null when unknown/inactive/exhausted. */
export async function resolvePromoCut(code: string, subtotal: number): Promise<number | null> {
  const row = await db.promoCode.findUnique({ where: { code: code.toUpperCase() } });
  if (!row || !row.active) return null;
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return null;
  const cut = row.type === "percent" ? Math.round((subtotal * row.value) / 100) : row.value;
  return Math.max(0, Math.min(cut, subtotal));
}

/**
 * Atomically consume one promo redemption inside the order-creation
 * transaction. Optimistic guard on usedCount: concurrent checkouts racing
 * for the last slot resolve to exactly one winner; the loser is told the
 * code ran out and can retry.
 */
export async function consumePromoCut(
  tx: Prisma.TransactionClient,
  code: string,
): Promise<boolean> {
  const row = await tx.promoCode.findUnique({
    where: { code: code.toUpperCase() },
    select: { active: true, maxUses: true, usedCount: true },
  });
  if (!row || !row.active) return false;
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return false;
  if (row.maxUses === null) {
    await tx.promoCode.update({
      where: { code: code.toUpperCase() },
      data: { usedCount: { increment: 1 } },
    });
    return true;
  }
  const updated = await tx.promoCode.updateMany({
    where: { code: code.toUpperCase(), usedCount: row.usedCount },
    data: { usedCount: { increment: 1 } },
  });
  return updated.count > 0;
}

// ---------------------------------------------------------------------------
// Payment notification state machine
// ---------------------------------------------------------------------------

export interface PaymentNotifyInput {
  /** our order code (Midtrans `order_id`) */
  orderCode: string;
  /** Midtrans `transaction_status` */
  status: string;
  fraudStatus?: string;
  /** Midtrans `gross_amount` — must equal the payment row amount */
  grossAmount: number;
  raw: unknown;
}

export interface PaymentNotifyResult {
  ok: boolean;
  alreadyProcessed?: boolean;
  reason?: string;
}

const FAILURE_PAYMENT_STATUS: Record<string, string> = {
  deny: "failed",
  cancel: "failed",
  expire: "expired",
  refund: "refunded",
  partial_refund: "refunded",
};

const FAILURE_ORDER_STATUS: Record<string, string> = {
  deny: "cancelled",
  cancel: "cancelled",
  expire: "cancelled",
  refund: "refunded",
  partial_refund: "refunded",
};

/**
 * Apply a payment notification (webhook or sim settle) to its Order/Payment.
 * Idempotent: replays of settled or terminal payments return ok without
 * re-toggling state. Amount must match or the notification is rejected.
 * Catalog orders restore stock on failure/cancel/refund.
 *
 * IMPORTANT: every branch that mutates state guards `order.status` so a late
 * or replayed notification cannot resurrect a cancelled order or cancel an
 * already-shipped one.
 */
export async function applyPaymentNotification(
  input: PaymentNotifyInput,
): Promise<PaymentNotifyResult> {
  const order = await db.order.findUnique({
    where: { code: input.orderCode },
    include: {
      payment: true,
      product: { select: { autoReleaseHours: true } },
      buyer: { select: { id: true } },
    },
  });
  if (!order || !order.payment) return { ok: false, reason: "order_not_found" };
  const payment = order.payment;

  const isSuccessStatus = input.status === "settlement" || input.status === "capture";
  const isFailureStatus = input.status in FAILURE_PAYMENT_STATUS;

  // Midtrans reports gross_amount as a numeric string ("150000.00").
  if (input.grossAmount !== payment.amount) {
    return { ok: false, reason: "amount_mismatch" };
  }

  const rawJson = JSON.stringify(input.raw ?? null);

  // Idempotent replays of already-settled success.
  if (payment.status === "settled" && isSuccessStatus && input.fraudStatus !== "deny") {
    return { ok: true, alreadyProcessed: true };
  }
  // Pending heartbeat: only useful while the payment row is still pending.
  if (input.status === "pending") {
    if (payment.status !== "pending") {
      return { ok: true, alreadyProcessed: true };
    }
    await db.payment.update({ where: { id: payment.id }, data: { rawJson } });
    return { ok: true };
  }

  // Success path: only allowed while order is still awaiting payment.
  // The flip is guarded INSIDE the transaction — a concurrent expiry/cancel
  // that lands between the read above and this write loses instead of being
  // resurrected back to paid.
  if (isSuccessStatus && input.fraudStatus !== "deny") {
    const autoReleaseHours = order.product?.autoReleaseHours ?? 24;
    const flipped = await db.$transaction(async (tx) => {
      const updated = await tx.order.updateMany({
        where: { id: order.id, status: "pending_payment" },
        data: {
          status: "paid",
          autoReleaseAt: new Date(Date.now() + autoReleaseHours * 3_600_000),
        },
      });
      if (updated.count === 0) return false;
      await tx.payment.updateMany({
        where: { id: payment.id, status: "pending" },
        data: { status: "settled", rawJson },
      });
      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "paid",
          label: "Pembayaran diterima — dana ditahan platform",
          actor: "system",
        },
      });
      return true;
    });
    if (!flipped) {
      // Lost the race — but one loser deserves a second look: a genuine
      // gateway settlement for an order the sweep already cancelled is REAL
      // money. Credit it back to the buyer instead of absorbing it silently.
      // (Refunded orders already paid the buyer back — skip those.)
      if (order.status === "cancelled" && payment.status === "pending") {
        const credited = await db.$transaction(async (tx) => {
          const dup = await tx.walletLedger.findFirst({
            where: { orderCode: order.code, type: "refund" },
            select: { id: true },
          });
          if (dup) return false;
          const aggregate = await tx.walletLedger.aggregate({
            where: { userId: order.buyer.id },
            _sum: { amount: true },
          });
          await tx.walletLedger.create({
            data: {
              userId: order.buyer.id,
              type: "refund",
              amount: payment.amount,
              balanceAfter: (aggregate._sum.amount ?? 0) + payment.amount,
              note: `Pembayaran telat ${order.code} — dikembalikan sebagai saldo`,
              orderCode: order.code,
            },
          });
          await tx.payment.updateMany({
            where: { id: payment.id, status: "pending" },
            data: { status: "settled", rawJson },
          });
          await tx.orderEvent.create({
            data: {
              orderId: order.id,
              state: order.status,
              label: "Pembayaran telat diterima gateway — dikembalikan sebagai saldo",
              actor: "system",
            },
          });
          return true;
        });
        if (credited) {
          await notify({
            userId: order.buyer.id,
            kind: "order_refunded",
            title: `Pembayaran telat ${order.code} dikembalikan`,
            body: "Gateway melunasi setelah order kedaluwarsa — dana masuk sebagai saldo akun.",
            link: `/pesanan/${order.code}`,
          });
        }
      }
      return { ok: true, alreadyProcessed: true };
    }
    await notify({
      userId: order.buyer.id,
      kind: "order_paid",
      title: `Pembayaran ${order.code} diterima`,
      body: "Dana ditahan platform — penjual segera memproses pesananmu.",
      link: `/pesanan/${order.code}`,
    });
    // Pool race: the order is claimable from this instant — ping every
    // seller Discord webhook. Fire-and-forget, never throws.
    if (order.isPoolOrder && !order.sellerId) {
      await broadcastPoolOrder({
        code: order.code,
        kind: order.kind,
        kindLabel: poolKindLabel(order.kind),
        robuxAmount: order.robuxAmount,
        total: order.total,
      });
    }
    return { ok: true };
  }

  // Failure/cancel/expire/refund/deny path.
  const failStatus = isFailureStatus || (isSuccessStatus && input.fraudStatus === "deny");
  if (failStatus) {
    const key = isSuccessStatus ? "deny" : input.status;
    const nextPaymentStatus = FAILURE_PAYMENT_STATUS[key] ?? "failed";
    const nextOrderStatus = FAILURE_ORDER_STATUS[key] ?? "cancelled";
    const isRefund = nextOrderStatus === "refunded";

    // We only mutate state from a pending order. A refund on an already-paid
    // order must be handled by admin (clawback / buyer credit), so we ack it
    // as already-processed to stop Midtrans retries.
    if (order.status !== "pending_payment") {
      return { ok: true, alreadyProcessed: true };
    }

    const label = isRefund
      ? "Pembayaran dikembalikan (refund)"
      : "Pembayaran dibatalkan";
    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (order.productId) {
      ops.push(
        db.product.update({
          where: { id: order.productId },
          data: { stock: { increment: order.quantity } },
        }),
      );
    }
    ops.push(
      db.payment.update({
        where: { id: payment.id },
        data: { status: nextPaymentStatus, rawJson },
      }),
      db.order.update({ where: { id: order.id }, data: { status: nextOrderStatus } }),
      db.orderEvent.create({
        data: {
          orderId: order.id,
          state: nextOrderStatus,
          label,
          actor: "system",
        },
      }),
    );
    await db.$transaction(ops);
    if (order.productId) revalidateTag("catalog", { expire: 0 });
    // Never leave a buyer guessing — a failed/cancelled/refunded payment must
    // say so in their inbox, not just sit silently on the order page.
    await notify({
      userId: order.buyer.id,
      kind: isRefund ? "order_refunded" : "order_cancelled",
      title: isRefund
        ? `Pembayaran ${order.code} dikembalikan`
        : `Pembayaran ${order.code} gagal`,
      body: isRefund
        ? "Dana dikembalikan oleh gateway. Saldo otomatis masuk ke dompetmu."
        : "Tagihan dibatalkan/ditolak. Stok sudah dilepas dan tidak ada dana yang ditahan.",
      link: `/pesanan/${order.code}`,
    });
    return { ok: true };
  }

  return { ok: false, reason: `unknown_status:${input.status}` };
}
