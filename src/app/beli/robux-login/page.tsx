import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { RobuxLoginOrder } from "@/components/order/robux-login-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Robux via Login",
  description:
    "Top up Robux via Login proses kilat 5-15 menit dengan enkripsi kredensial AES-256 aman di Blox Astra.",
};

export default function RobuxLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-28 md:px-8 md:pt-36">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-3xl" />
        </div>
      }
    >
      <RobuxLoginContent />
    </Suspense>
  );
}

async function RobuxLoginContent() {
  await connection();
  const user = await getCurrentUser();
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  return <RobuxLoginOrder isLoggedIn={Boolean(user)} walletBalance={walletBalance} />;
}
