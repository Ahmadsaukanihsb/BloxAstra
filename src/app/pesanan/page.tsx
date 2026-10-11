import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrdersForViewer } from "@/lib/orders";
import { OrderList } from "@/components/order/order-list";
import { Skeleton } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Pesanan saya",
  description:
    "Pantau pesanan berjalan, riwayat transaksi, status dana, dan ruang chat per pesanan di Blox Astra.",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-10 md:pt-14">
          <Skeleton className="h-9 w-56" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-well" />
            ))}
          </div>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}

async function OrdersContent() {
  await connection();
  const user = await requireUser();
  const { orders, heldTotal } = await getOrdersForViewer(user);

  return <OrderList orders={orders} heldTotal={heldTotal} viewerRole={user.role} />;
}
