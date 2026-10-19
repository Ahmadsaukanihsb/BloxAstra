import type { Prisma } from "@prisma/client";

/**
 * One place for the wallet-ledger append.
 *
 * This was copy-pasted into five server modules (orders, room, admin, wallet,
 * sweep) and the six `isUniqueCollision` helpers beside them — identical code
 * whose balance arithmetic could drift one path at a time. Both live here now.
 */

export interface LedgerEntryInput {
  userId: string;
  /** Null for buyer-side movements (purchases, refunds); the seller's profile id otherwise. */
  sellerId?: string | null;
  type: string;
  amount: number;
  note: string;
  orderCode?: string;
}

/**
 * Append a ledger row, deriving `balanceAfter` from the running sum. Must run
 * inside the caller's transaction so the read and the write cannot straddle
 * another movement for the same user.
 */
export async function appendLedger(tx: Prisma.TransactionClient, data: LedgerEntryInput) {
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

/** Prisma unique-constraint violation (P2002) — retry the code/attempt loop. */
export function isUniqueCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
