import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import {
  ROBUX_AMOUNT_PARAM,
  ROBUX_ORDERS,
  clampRobuxAmount,
} from "@/lib/robux-orders";
import { RobuxUsernameOrder } from "@/components/order/robux-username-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Robux via Username",
  description:
    "Top up Robux via Username langsung masuk tanpa pending dan tanpa password di Blox Astra.",
  // A nominal carried in via ?nominal= is the same page — canonicalize the
  // bare URL so quick-buy links never split into indexed duplicates.
  alternates: { canonical: "/beli/robux-username" },
};

export default function RobuxUsernamePage(props: PageProps<"/beli/robux-username">) {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-24 md:pt-28">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-card" />
        </div>
      }
    >
      <RobuxUsernameContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function RobuxUsernameContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  // A nominal handed over from the lobby's quick-buy counter. Clamped against
  // this flow's own grid, so a hand-edited URL can never produce a bad amount.
  const initialRobux = clampRobuxAmount(ROBUX_ORDERS.username, params[ROBUX_AMOUNT_PARAM]);
  return (
    <RobuxUsernameOrder
      isLoggedIn={Boolean(user)}
      walletBalance={walletBalance}
      initialRobux={initialRobux}
    />
  );
}
