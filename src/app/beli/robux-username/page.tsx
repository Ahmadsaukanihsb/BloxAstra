import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { RobuxUsernameOrder } from "@/components/order/robux-username-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Robux via Username",
  description:
    "Top up Robux via Username langsung masuk tanpa pending dan tanpa password di Blox Astra.",
};

export default function RobuxUsernamePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-28 md:px-8 md:pt-36">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-3xl" />
        </div>
      }
    >
      <RobuxUsernameContent />
    </Suspense>
  );
}

async function RobuxUsernameContent() {
  await connection();
  const user = await getCurrentUser();
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  return <RobuxUsernameOrder isLoggedIn={Boolean(user)} walletBalance={walletBalance} />;
}
