import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { ROBUX_AMOUNT_PARAM, ROBUX_ORDERS, clampRobuxAmount } from "@/lib/robux-orders";
import { RobuxLoginOrder } from "@/components/order/robux-login-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Robux via Login",
  description:
    "Top up Robux via Login proses kilat 5-15 menit dengan enkripsi kredensial AES-256 aman di Blox Astra.",
  alternates: { canonical: "/beli/robux-login" },
};

export default function RobuxLoginPage(props: PageProps<"/beli/robux-login">) {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-24 md:pt-28">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-card" />
        </div>
      }
    >
      <RobuxLoginContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function RobuxLoginContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  // Carried over from the lobby's quick-buy counter, clamped to this flow.
  const initialRobux = clampRobuxAmount(ROBUX_ORDERS.login, params[ROBUX_AMOUNT_PARAM]);
  return (
    <RobuxLoginOrder
      isLoggedIn={Boolean(user)}
      walletBalance={walletBalance}
      initialRobux={initialRobux}
    />
  );
}
