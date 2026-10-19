import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerIdentity } from "@/lib/seller";
import { getPoolOrders, getSellerActiveOrders, getSellerOrderHistory } from "@/lib/orders";
import { formatIDR } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { ActiveOrderRow, SellerHistory } from "@/components/seller/seller-history";
import { SellerPageHeader, SellerSection, SellerStack } from "@/components/seller/seller-page";
import { IconArrowRight, IconHexCoin, IconInfo } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Pesanan penjual",
  description:
    "Antrean pesanan berjalan dengan jam SLA, riwayat lengkap, dan ringkasan order rebutan.",
  robots: { index: false, follow: false },
};

export default function SellerOrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}

function OrdersSkeleton() {
  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-12 w-72 max-w-full" />
      <Skeleton className="mt-10 h-80 w-full rounded-card" />
    </div>
  );
}

async function OrdersContent() {
  await connection();
  const user = await requireUser();
  const isAdminPreview = user.role === "admin";

  const identity = await getSellerIdentity(user.id);
  if (!identity) {
    return (
      <div className="shell pb-20 pt-8 md:pt-10">
        <Notice tone="danger" title="Profil penjual belum dibuat">
          Akun ini belum memiliki profil toko, jadi belum ada pesanan yang bisa ditampilkan.
        </Notice>
      </div>
    );
  }

  const [activeOrders, history, poolOrders] = await Promise.all([
    getSellerActiveOrders(identity.sellerId, user.id),
    getSellerOrderHistory(identity.sellerId, user.id),
    getPoolOrders(),
  ]);

  const poolValue = poolOrders.reduce((sum, order) => sum + order.total, 0);

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <SellerStack>
        <SellerPageHeader
          eyebrow="Pesanan"
          title="Antrean & riwayat"
          lede="Setiap pesanan menahan dana pembeli sampai kamu selesai serah terima dan pembeli mengonfirmasi. Jam SLA di bawah tiap baris menunjukkan sisa waktu sebelum pesanan dianggap terlambat."
          actions={
            <ButtonLink
              href="/dashboard/penjual/order-robux"
              variant="secondary"
              trailingIcon={<IconArrowRight size={15} />}
              iconCircleClassName="bg-canvas"
            >
              Papan rebutan
            </ButtonLink>
          }
        />

        <SellerSection
          title={`Pesanan berjalan (${activeOrders.length})`}
          description="Yang menunggu tindakanmu sekarang."
        >
          {activeOrders.length === 0 ? (
            <p className="text-[12.5px] text-ink-mute">
              Tidak ada pesanan aktif. Begitu ada checkout, pesanan muncul di sini.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-line">
              {activeOrders.map((order) => (
                <ActiveOrderRow key={order.id} order={order} />
              ))}
            </div>
          )}
        </SellerSection>

        {poolOrders.length > 0 ? (
          <SellerSection
            title="Order rebutan menunggu diambil"
            description={`${poolOrders.length} pesanan lunas belum punya penjual${
              poolValue > 0 ? ` · total ${formatIDR(poolValue)}` : ""
            }. ${
              identity.kycVerified
                ? "Kamu bisa mengambilnya sekarang."
                : "Ambil hanya setelah KYC disetujui."
            }`}
            action={
              <ButtonLink
                href="/dashboard/penjual/order-robux"
                size="sm"
                trailingIcon={<IconArrowRight size={14} />}
              >
                <IconHexCoin size={14} />
                Buka papan
              </ButtonLink>
            }
          >
            {!identity.kycVerified ? (
              <Notice
                tone="warn"
                icon={<IconInfo size={15} />}
                title="KYC belum disetujui"
              >
                Pengambilan order dari pool ditolak server sampai identitasmu diverifikasi admin.
              </Notice>
            ) : null}
          </SellerSection>
        ) : null}

        {isAdminPreview ? (
          <Notice tone="info" icon={<IconInfo size={15} />} title="Mode preview admin">
            Kamu melihat antrean sebagai admin. Aksi yang mengubah status pesanan tetap dijalankan
            sebagai penjual pemilik pesanan.
          </Notice>
        ) : null}

        <SellerSection
          title="Riwayat lengkap"
          description="Semua pesanan yang pernah masuk ke tokomu, termasuk yang sudah selesai dan direfund."
        >
          <SellerHistory orders={history.orders} completedCount={history.completedCount} />
        </SellerSection>
      </SellerStack>
    </div>
  );
}
