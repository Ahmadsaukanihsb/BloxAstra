import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { isSimMode } from "@/lib/midtrans";
import { getCurrentUser } from "@/lib/auth";
import { SimPayCard, type SimOrderSummary } from "./sim-pay-card";

export const metadata: Metadata = {
  title: "Simulasi pembayaran",
  robots: { index: false, follow: false },
};

/** Sim-mode invoice page — stands in for the Midtrans Snap redirect. */
export default function SimPayPage(props: PageProps<"/bayar/sim">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[560px] px-4 pb-24 pt-28 md:pt-36">
          <div className="h-96 animate-pulse rounded-[1.6rem] bg-canvas" />
        </div>
      }
    >
      <SimPayContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SimPayContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.order === "string" ? params.order : "";
  if (!code) notFound();
  await connection();

  const user = await getCurrentUser();
  if (!user) redirect("/masuk");

  // Wallet top-ups (TU-XXXXXX) settle through the same sim screen.
  if (code.startsWith("TU-")) {
    const topUp = await db.topUp.findUnique({
      where: { code },
      select: { code: true, userId: true, amount: true, fee: true, status: true },
    });
    if (!topUp) notFound();
    if (topUp.userId !== user.id) redirect("/pesanan");
    const summary: SimOrderSummary = {
      orderCode: topUp.code,
      kind: "topup",
      itemTitle: "Top-up saldo dompet",
      total: topUp.amount + topUp.fee,
      status: topUp.status === "credited" ? "completed" : topUp.status,
      paymentStatus: topUp.status === "credited" ? "settled" : "pending",
      expiresAt: null,
    };
    return (
      <div className="mx-auto max-w-[560px] px-4 pb-24 pt-28 md:pt-36">
        <SimPayCard order={summary} simMode={isSimMode()} />
      </div>
    );
  }

  const order = await db.order.findUnique({
    where: { code },
    include: {
      payment: { select: { amount: true, status: true, expiresAt: true } },
      product: { select: { title: true } },
    },
  });
  if (!order || !order.payment) notFound();
  if (order.buyerId !== user.id) redirect("/pesanan");

  const summary: SimOrderSummary = {
    orderCode: order.code,
    kind: "order",
    itemTitle: order.product?.title ?? `${order.robuxAmount ?? 0} Robux`,
    total: order.payment.amount,
    status: order.status,
    paymentStatus: order.payment.status,
    expiresAt: order.payment.expiresAt?.toISOString() ?? null,
  };

  return (
    <div className="mx-auto max-w-[560px] px-4 pb-24 pt-28 md:pt-36">
      <SimPayCard order={summary} simMode={isSimMode()} />
    </div>
  );
}
