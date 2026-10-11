import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerIdentity, getSellerInventory } from "@/lib/seller";
import { getCategories } from "@/lib/catalog";
import { ButtonLink } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { ListingForm } from "@/components/seller/listing-form";
import { ListingManager } from "@/components/seller/listing-manager";
import { SellerPageHeader, SellerSection, SellerStack } from "@/components/seller/seller-page";
import { IconArrowRight, IconInfo, IconShieldCheck } from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Listing penjual",
  description: "Terbitkan produk baru, atur harga dan stok, lalu jeda atau lanjutkan tayang.",
  robots: { index: false, follow: false },
};

export default function SellerListingsPage() {
  return (
    <Suspense fallback={<ListingsSkeleton />}>
      <ListingsContent />
    </Suspense>
  );
}

function ListingsSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-5 h-12 w-64 max-w-full" />
      <Skeleton className="mt-10 h-96 w-full rounded-3xl" />
    </div>
  );
}

async function ListingsContent() {
  await connection();
  const user = await requireUser();
  const isAdminPreview = user.role === "admin";

  const identity = await getSellerIdentity(user.id);
  if (!identity) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
        <Notice tone="danger" title="Profil penjual belum dibuat">
          Akun ini belum memiliki profil toko, jadi belum ada listing yang bisa dikelola.
        </Notice>
      </div>
    );
  }

  const [inventory, categories] = await Promise.all([
    getSellerInventory(identity.sellerId),
    getCategories(),
  ]);

  const listed = inventory.filter((item) => item.isListed).length;
  const paused = inventory.length - listed;
  const lowStock = inventory.filter((item) => item.isListed && item.stock < 20).length;
  const kycLocked = !identity.kycVerified;

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <SellerStack>
        <SellerPageHeader
          eyebrow="Listing"
          title="Katalog tokomu"
          lede={
            inventory.length === 0
              ? "Belum ada listing. Produk yang kamu terbitkan tampil di katalog selama toko berstatus siap kirim, dan stoknya berkurang otomatis setiap ada checkout."
              : `${inventory.length} listing — ${listed} tayang, ${paused} dijeda${
                  lowStock > 0 ? `, ${lowStock} berstok tipis` : ""
                }. Mengubah harga tidak memengaruhi pesanan yang sudah masuk.`
          }
          actions={
            <ButtonLink
              href="/katalog"
              variant="secondary"
              trailingIcon={<IconArrowRight size={15} />}
              iconCircleClassName="bg-canvas"
            >
              Lihat di katalog
            </ButtonLink>
          }
        />

        {isAdminPreview ? (
          <Notice tone="info" icon={<IconInfo size={15} />} title="Mode preview admin">
            Pembuatan dan penyuntingan listing dinonaktifkan dalam preview admin karena aksi ini
            terikat ke kepemilikan toko.
          </Notice>
        ) : kycLocked ? (
          <Notice
            tone="warn"
            icon={<IconShieldCheck size={15} />}
            title="Listing dikunci — KYC belum disetujui"
          >
            Form di bawah aktif lagi otomatis setelah admin menyetujui identitasmu. Mengirim
            sekarang pun akan ditolak server.
          </Notice>
        ) : null}

        {!isAdminPreview && !kycLocked ? (
          <SellerSection
            title="Terbitkan listing baru"
            description="Judul, harga, dan stok bisa diubah kapan saja setelah tayang."
          >
            <ListingForm categories={categories} />
          </SellerSection>
        ) : null}

        <SellerSection
          title={`Kelola listing (${inventory.length})`}
          description="Jeda tayang kapan saja tanpa menghapus data — pesanan yang sedang berjalan tidak terpengaruh."
        >
          {inventory.length === 0 ? (
            <p className="text-[12.5px] text-ink-mute">
              Belum ada listing untuk dikelola.
            </p>
          ) : isAdminPreview ? (
            <div className="flex flex-col divide-y divide-hairline">
              {inventory.map((item) => (
                <div key={item.slug} className="flex items-center gap-4 py-3.5 first:pt-0">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[12.5px] text-ink">{item.title}</span>
                    <span className="text-[10px] text-ink-mute">{item.game}</span>
                  </div>
                  <span className="num w-16 shrink-0 text-right text-[12px] text-ink-dim">
                    {item.stock}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <ListingManager items={inventory} />
          )}
        </SellerSection>
      </SellerStack>
    </div>
  );
}
