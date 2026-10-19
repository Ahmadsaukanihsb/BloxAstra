import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { TOPUP_LIMITS } from "@/lib/topup-limits";
import { formatNumber } from "@/lib/format";

export { TOPUP_LIMITS };

/** "TU-" + 6 unambiguous base36 chars — also the gateway merchant_ref. */
export function generateTopUpCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `TU-${out}`;
}

export interface TopUpLedgerInput {
  userId: string;
  code: string;
  amount: number;
  /**
   * True only when a gateway confirmed the settlement (signed webhook or a
   * Status API answer). It lets a row that was wrongly flagged `failed`
   * still be credited — the buyer's money really did arrive, and refusing it
   * would pocket it.
   */
  settledByGateway?: boolean;
}

/** Statuses a top-up can still be credited from. */
export const CREDITABLE_TOPUP_STATUSES = ["pending", "expired"] as const;

/**
 * Credit a settled top-up to the buyer's wallet ledger. Idempotent: the
 * `@@unique` on (orderCode, type) plus a status guard inside the transaction
 * means a replayed webhook credits exactly once. `expired` rows are still
 * accepted — a gateway settlement that lands just after the expiry sweep is
 * real money and must not be dropped — and so is `failed` when the caller
 * has gateway proof (`settledByGateway`).
 */
export async function creditTopUp(input: TopUpLedgerInput): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const topUp = await tx.topUp.findUnique({
        where: { code: input.code },
        select: { id: true, status: true, amount: true, userId: true, creditedAt: true },
      });
      const creditable =
        topUp?.status === "pending" ||
        topUp?.status === "expired" ||
        (input.settledByGateway === true && topUp?.status === "failed");
      if (!topUp || topUp.creditedAt || !creditable) return false;
      if (topUp.userId !== input.userId || topUp.amount !== input.amount) return false;

      const aggregate = await tx.walletLedger.aggregate({
        where: { userId: input.userId },
        _sum: { amount: true },
      });
      const balanceAfter = (aggregate._sum.amount ?? 0) + input.amount;

      await tx.walletLedger.create({
        data: {
          userId: input.userId,
          type: "topup",
          amount: input.amount,
          balanceAfter,
          note: `Top-up saldo ${input.code}`,
          orderCode: input.code,
        },
      });
      await tx.topUp.update({
        where: { id: topUp.id },
        data: { status: "credited", creditedAt: new Date() },
      });
      return true;
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "P2002") return false; // already credited
    throw error;
  }
}

/** Notify the buyer that their top-up landed (safe, fire-and-forget). */
export async function notifyTopUpCredited(userId: string, code: string, amount: number): Promise<void> {
  await notify({
    userId,
    kind: "topup_paid",
    title: `Saldo bertambah ${formatNumber(amount)} IDR`,
    body: `Top-up ${code} berhasil. Saldo siap dipakai untuk belanja.`,
    link: "/dompet",
  });
}

export interface OpenTopUp {
  code: string;
  amount: number;
  fee: number;
  paymentMethod: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
  status: "pending" | "failed" | "expired";
}

/**
 * Top-ups a buyer (or seller) still has to act on: invoices waiting for
 * payment, plus rows that never got credited. The uncredited group is the
 * safety net for the "paid but saldo tidak bertambah" case — without it the
 * money sits invisible in the database with no button to recover it.
 */
export async function getOpenTopUps(userId: string): Promise<OpenTopUp[]> {
  const rows = await db.topUp.findMany({
    where: {
      userId,
      creditedAt: null,
      status: { in: ["pending", "failed", "expired"] },
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: {
      code: true,
      amount: true,
      fee: true,
      paymentMethod: true,
      checkoutUrl: true,
      expiresAt: true,
      status: true,
    },
  });
  return rows.map((row) => ({
    code: row.code,
    amount: row.amount,
    fee: row.fee,
    paymentMethod: row.paymentMethod,
    checkoutUrl: row.checkoutUrl,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    status: row.status as OpenTopUp["status"],
  }));
}

/** Top-ups still waiting after their payment window are marked expired. */
export async function expireStaleTopUps(): Promise<string[]> {
  // Keyed off expiresAt (invoice lifetime + grace), not a second hardcoded
  // clock — a settlement landing just after expiry is still credited by
  // creditTopUp, so expiry is bookkeeping, not a guillotine.
  const now = new Date();
  const stale = await db.topUp.findMany({
    where: { status: "pending", expiresAt: { lte: new Date(now.getTime() - 15 * 60_000) } },
    select: { id: true, code: true, userId: true },
    take: 20,
  });
  if (stale.length === 0) return [];

  await db.topUp.updateMany({
    where: { id: { in: stale.map((row) => row.id) }, status: "pending" },
    data: { status: "expired" },
  });
  for (const row of stale) {
    await notify({
      userId: row.userId,
      kind: "topup_expired",
      title: `Top-up ${row.code} kedaluwarsa`,
      body: "Jendela pembayaran habis. Ajukan ulang bila kamu belum membayar.",
      link: "/dompet",
    });
  }
  return stale.map((row) => row.code);
}
