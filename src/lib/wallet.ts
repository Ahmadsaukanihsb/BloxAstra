import "server-only";
import { db } from "@/lib/db";
import { ESCROW_ORDER_STATES } from "@/lib/order-meta";

export interface WalletEntryView {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  orderCode: string | null;
  note: string;
  createdAt: string;
}

export interface WalletView {
  balanceAvailable: number;
  balanceLocked: number;
  negativeDebt: number;
  tier: 1 | 2 | 3;
  entries: WalletEntryView[];
  banks: string[];
  withdrawal: { minAmount: number; fee: number };
}

const DEFAULT_BANKS = ["BCA", "BNI", "Mandiri", "BRI", "CIMB Niaga", "GoPay", "OVO", "DANA"];
const DEFAULT_WITHDRAWAL = { minAmount: 20_000, fee: 2_500 };

export async function getBanks(): Promise<string[]> {
  const setting = await db.setting.findUnique({ where: { key: "banks" } });
  if (!setting) return DEFAULT_BANKS;
  try {
    const parsed = JSON.parse(setting.value) as unknown;
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) {
      return parsed as string[];
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_BANKS;
}

export async function getWithdrawalConfig(): Promise<{ minAmount: number; fee: number }> {
  const setting = await db.setting.findUnique({ where: { key: "withdrawal" } });
  if (!setting) return DEFAULT_WITHDRAWAL;
  try {
    const parsed = JSON.parse(setting.value) as Record<string, unknown>;
    const minRaw = Number(parsed.minAmount);
    const feeRaw = Number(parsed.fee);
    return {
      minAmount: Number.isFinite(minRaw) && minRaw >= 0 ? minRaw : DEFAULT_WITHDRAWAL.minAmount,
      fee: Number.isFinite(feeRaw) && feeRaw >= 0 ? feeRaw : DEFAULT_WITHDRAWAL.fee,
    };
  } catch {
    return DEFAULT_WITHDRAWAL;
  }
}

/** Spendable wallet balance for any user (buyer refunds, seller earnings). */
export async function getWalletBalance(userId: string): Promise<number> {
  const aggregate = await db.walletLedger.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return aggregate._sum.amount ?? 0;
}

/** Wallet summary + ledger for a seller user. */
export async function getSellerWallet(userId: string): Promise<WalletView> {
  const profile = await db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true, tier: true },
  });

  const [aggregate, penaltyAggregate, ledgerRows, banks, withdrawal] = await Promise.all([
    db.walletLedger.aggregate({ where: { userId }, _sum: { amount: true } }),
    db.walletLedger.aggregate({
      where: { userId, type: "penalty_debt" },
      _sum: { amount: true },
    }),
    db.walletLedger.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    getBanks(),
    getWithdrawalConfig(),
  ]);

  let balanceLocked = 0;
  if (profile) {
    const escrowOrders = await db.order.findMany({
      where: { sellerId: profile.id, status: { in: [...ESCROW_ORDER_STATES] } },
      select: { total: true, platformFee: true },
    });
    balanceLocked = escrowOrders.reduce((sum, order) => sum + order.total - order.platformFee, 0);
  }

  const penaltySum = penaltyAggregate._sum.amount ?? 0;

  return {
    balanceAvailable: aggregate._sum.amount ?? 0,
    balanceLocked,
    negativeDebt: penaltySum < 0 ? Math.abs(penaltySum) : 0,
    tier: ((profile?.tier ?? 1) as 1 | 2 | 3),
    entries: ledgerRows.map((row) => ({
      id: row.id,
      type: row.type,
      amount: row.amount,
      balanceAfter: row.balanceAfter,
      orderCode: row.orderCode,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
    })),
    banks,
    withdrawal,
  };
}
