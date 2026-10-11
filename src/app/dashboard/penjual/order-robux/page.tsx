import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRobuxPool } from "@/lib/orders";
import { Skeleton } from "@/components/ui/feedback";
import { RobuxPoolBoard } from "@/components/seller/robux-pool";
import { IconHexCoin } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Order Robux · rebutan",
  description:
    "Pool order Robux dan Premium Roblox yang sudah dibayar — rebut secepat mungkin sebelum diambil penjual lain.",
  robots: { index: false, follow: false },
};

export default function OrderRobuxPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="mt-6 h-40 w-full rounded-3xl" />
          <Skeleton className="mt-3 h-40 w-full rounded-3xl" />
        </div>
      }
    >
      <OrderRobuxContent />
    </Suspense>
  );
}

async function OrderRobuxContent() {
  await connection();
  const user = await requireUser();
  const canClaim = user.role === "seller" || user.role === "admin";
  const profile =
    user.role === "seller"
      ? await db.sellerProfile.findUnique({
          where: { userId: user.id },
          select: { kycVerified: true },
        })
      : null;
  const locked = user.role === "seller" && !profile?.kycVerified;
  const pool = await getRobuxPool();

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconHexCoin size={16} className="text-astra-ink" />
            Order Robux · rebutan
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-[2.1rem]">
            Pool pesanan Robux
          </h1>
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            Order Robux (Username, Login, Gamepass) dan Premium Roblox dari pembeli masuk ke sini
            begitu dibayar. Yang pertama mengklik{" "}
            <span className="font-bold text-ink">Ambil order</span> yang mendapatkannya — penjual
            lain otomatis kalah. Setelah diambil, pesanan langsung berstatus diproses atas namamu.
          </p>
        </div>

        <RobuxPoolBoard orders={pool} canClaim={canClaim} locked={locked} />
      </div>
    </div>
  );
}
