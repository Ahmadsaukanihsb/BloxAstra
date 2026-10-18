import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { ROBUX_AMOUNT_PARAM, ROBUX_ORDERS, clampRobuxAmount } from "@/lib/robux-orders";
import { RobuxGamepassOrder } from "@/components/order/robux-gamepass-order";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Beli Robux via Gamepass",
  description:
    "Beli Robux via Gamepass dengan Cover Tax 100% ditanggung kami, tanpa password akun di Blox Astra.",
  alternates: { canonical: "/beli/robux-gamepass" },
};

export default function RobuxGamepassPage(props: PageProps<"/beli/robux-gamepass">) {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-24 md:pt-28">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-80 w-full rounded-card" />
        </div>
      }
    >
      <RobuxGamepassContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function RobuxGamepassContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const walletBalance = user ? await getWalletBalance(user.id) : 0;
  // The lobby quotes net Robux, which is exactly what this flow asks for in
  // "cover" mode — the tax mode default — so the number transfers as-is.
  const initialRobux = clampRobuxAmount(ROBUX_ORDERS.gamepass, params[ROBUX_AMOUNT_PARAM]);
  return (
    <RobuxGamepassOrder
      isLoggedIn={Boolean(user)}
      walletBalance={walletBalance}
      initialRobux={initialRobux}
    />
  );
}
