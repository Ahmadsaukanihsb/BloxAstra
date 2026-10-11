import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { TOPUP_LIMITS } from "@/lib/topup-limits";

export { TOPUP_LIMITS };

/** "TU-" + 6 unambiguous base36 chars — also the Midtrans order_id. */
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
}

/**
 * Credit a settled top-up to the buyer's wallet ledger. Idempotent: the
 * `@@unique` on (orderCode, type) plus a status guard inside the transaction
 * means a replayed webhook credits exactly once. `expired` rows are still
 * accepted — a gateway settlement that lands just after the expiry sweep is
 * real money and must not be dropped.
 */
export async function creditTopUp(input: TopUpLedgerInput): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const topUp = await tx.topUp.findUnique({
        where: { code: input.code },
        select: { id: true, status: true, amount: true, userId: true },
      });
      if (!topUp || (topUp.status !== "pending" && topUp.status !== "expired")) return false;
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
    kind: "order_paid",
    title: `Saldo bertambah ${amount.toLocaleString("id-ID")} IDR`,
    body: `Top-up ${code} berhasil — saldo siap dipakai untuk belanja.`,
    link: "/dompet",
  });
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
      kind: "order_cancelled",
      title: `Top-up ${row.code} kedaluwarsa`,
      body: "Jendela pembayaran habis. Ajukan ulang bila kamu belum membayar.",
      link: "/dompet",
    });
  }
  return stale.map((row) => row.code);
}
