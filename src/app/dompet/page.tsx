import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSellerWallet } from "@/lib/wallet";
import { getPaymentFees } from "@/lib/payments";
import { WalletView } from "@/components/wallet/wallet-view";
import { BuyerWalletView } from "@/components/wallet/buyer-wallet-view";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Dompet",
  description:
    "Kelola saldo akun Blox Astra: top-up, pakai untuk belanja, dan pantau semua mutasi. Penarikan dana hanya tersedia untuk akun penjual.",
  robots: { index: false, follow: false },
};

export default function DompetPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-10 md:pt-14">
          <Skeleton className="h-9 w-56" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
            <Skeleton className="h-32 w-full rounded-card" />
          </div>
        </div>
      }
    >
      <DompetContent />
    </Suspense>
  );
}

async function DompetContent() {
  await connection();
  const user = await requireUser();
  const [wallet, fees] = await Promise.all([getSellerWallet(user.id), getPaymentFees()]);
  const methodFees = { qris: fees.qris, va: fees.va, ewallet: fees.ewallet };

  // Seller keeps the full ledger + withdrawal workspace.
  if (user.role === "seller") {
    return <WalletView wallet={wallet} methodFees={methodFees} />;
  }

  // Buyer gets a dedicated spend-focused wallet: no withdrawal traces.
  const [pending, sums] = await Promise.all([
    db.topUp.findMany({
      where: {
        userId: user.id,
        status: "pending",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        code: true,
        amount: true,
        fee: true,
        paymentMethod: true,
        checkoutUrl: true,
        expiresAt: true,
      },
    }),
    db.walletLedger.groupBy({
      by: ["type"],
      where: { userId: user.id },
      _sum: { amount: true },
    }),
  ]);

  const sumOf = (type: string) =>
    sums.find((row) => row.type === type)?._sum.amount ?? 0;

  return (
    <BuyerWalletView
      balanceAvailable={wallet.balanceAvailable}
      stats={{
        totalTopUp: Math.max(0, sumOf("topup")),
        totalSpent: Math.abs(Math.min(0, sumOf("purchase"))),
        totalRefund: Math.max(0, sumOf("refund")),
      }}
      pendingTopUps={pending.map((row) => ({
        code: row.code,
        amount: row.amount,
        fee: row.fee,
        paymentMethod: row.paymentMethod,
        checkoutUrl: row.checkoutUrl,
        expiresAt: row.expiresAt?.toISOString() ?? null,
      }))}
      entries={wallet.entries}
      methodFees={methodFees}
    />
  );
}
