import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerIdentity } from "@/lib/seller";
import { getSellerWallet } from "@/lib/wallet";
import { getOpenTopUps } from "@/lib/topup";
import { getPaymentFees } from "@/lib/payments";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { WalletView } from "@/components/wallet/wallet-view";
import { SellerPageHeader, SellerStack } from "@/components/seller/seller-page";

export const metadata: Metadata = {
  title: "Dompet penjual",
  description: "Saldo siap ditarik, dana yang masih ditahan escrow, mutasi ledger, dan penarikan.",
  robots: { index: false, follow: false },
};

export default function SellerWalletPage() {
  return (
    <Suspense fallback={<WalletSkeleton />}>
      <WalletContent />
    </Suspense>
  );
}

function WalletSkeleton() {
  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-5 h-12 w-56 max-w-full" />
      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-32 w-full rounded-card" />
      </div>
    </div>
  );
}

async function WalletContent() {
  await connection();
  const user = await requireUser();

  const identity = await getSellerIdentity(user.id);
  if (!identity) {
    return (
      <div className="shell pb-20 pt-8 md:pt-10">
        <Notice tone="danger" title="Profil penjual belum dibuat">
          Akun ini belum memiliki profil toko, jadi belum ada saldo penjual yang bisa ditarik.
        </Notice>
      </div>
    );
  }

  const [wallet, fees, openTopUps] = await Promise.all([
    getSellerWallet(user.id),
    getPaymentFees(),
    getOpenTopUps(user.id),
  ]);

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <SellerStack>
        <SellerPageHeader
          eyebrow="Dompet penjual"
          title="Saldo & penarikan"
          lede="Dana pembeli ditahan platform sampai serah terima dikonfirmasi, baru masuk ke saldo yang bisa ditarik. Setiap mutasi menyimpan saldo setelah transaksi, jadi tidak ada angka yang bisa ditimpa."
        />
        <WalletView
          wallet={wallet}
          methodFees={{ qris: fees.qris, va: fees.va, ewallet: fees.ewallet }}
          openTopUps={openTopUps}
          embedded
        />
      </SellerStack>
    </div>
  );
}
