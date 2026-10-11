import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { PremiumOrder } from "@/components/order/premium-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Roblox Premium",
  description:
    "Langganan Roblox Premium 1, 3, atau 12 bulan diproses penjual terverifikasi. Kredensial dienkripsi AES-256 di Blox Astra.",
};

export default function PremiumPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-24 md:pt-28">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-card" />
        </div>
      }
    >
      <PremiumContent />
    </Suspense>
  );
}

async function PremiumContent() {
  await connection();
  const user = await getCurrentUser();
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  return <PremiumOrder isLoggedIn={Boolean(user)} walletBalance={walletBalance} />;
}
