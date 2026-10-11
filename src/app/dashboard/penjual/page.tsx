import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getSellerDashboard } from "@/lib/seller";
import { formatDuration, formatIDR } from "@/lib/format";
import { EXPRESS_SLA_SECONDS } from "@/lib/order-meta";
import type { CategorySlug } from "@/lib/types";
import { Badge, LivePill, TierBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice, Skeleton } from "@/components/ui/feedback";
import { ProductArt } from "@/components/ui/art";
import { StatusPill } from "@/components/order/runtime";
import {
  IconArrowRight,
  IconBolt,
  IconInfo,
  IconPackage,
  IconShieldCheck,
  IconSliders,
  IconStorefront,
  IconTimer,
  IconWallet,
} from "@/components/ui/icons";
import { OnlineToggle, SellerStats, VolumeCap } from "@/components/seller/seller-shell";
import { ActiveOrderRow } from "@/components/seller/seller-history";
import {
  SellerGrid,
  SellerPageHeader,
  SellerSection,
  SellerStack,
} from "@/components/seller/seller-page";
import { getPoolOrders, getSellerActiveOrders } from "@/lib/orders";

export const metadata: Metadata = {
  title: "Ringkasan penjual",
  description:
    "Ringkasan performa toko: status siap kirim, volume harian, pesanan berjalan, dan kesehatan serah terima.",
  robots: { index: false, follow: false },
};

export default function SellerOverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-5 h-12 w-80 max-w-full" />
      <Skeleton className="mt-4 h-4 w-[420px] max-w-full" />
      <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    </div>
  );
}

async function OverviewContent() {
  await connection();
  const user = await requireUser();
  const isAdminPreview = user.role === "admin";

  const dashboard = await getSellerDashboard(user.id);
  if (!dashboard) {
    return (
      <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
        {isAdminPreview ? (
          <Notice tone="info" title="Mode preview">
            Akun admin tidak memiliki profil penjual. Aktifkan profil penjual dari halaman Super
            Dashboard untuk melihat area ini dengan data nyata.
          </Notice>
        ) : (
          <Notice tone="danger" title="Profil penjual belum dibuat">
            Akun ini belum memiliki profil toko. Hubungi admin untuk aktivasi penjual.
          </Notice>
        )}
      </div>
    );
  }

  const [activeOrders, poolOrders] = await Promise.all([
    getSellerActiveOrders(dashboard.sellerId),
    getPoolOrders(),
  ]);

  const kyc = dashboard.kycVerified
    ? { tone: "astra" as const, label: "KYC terverifikasi" }
    : dashboard.kycStatus === "rejected"
      ? { tone: "danger" as const, label: "KYC ditolak" }
      : { tone: "warn" as const, label: "KYC menunggu" };

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-10 md:px-8 md:pt-14">
      <SellerStack>
        {isAdminPreview ? (
          <Notice tone="info" icon={<IconInfo size={15} />} title="Preview dashboard penjual">
            Kamu melihat area penjual sebagai admin. Sakelar online dan penarikan dinonaktifkan di
            mode ini.
          </Notice>
        ) : null}

        <SellerPageHeader
          eyebrow="Dashboard penjual"
          title={dashboard.storeName}
          lede="Sakelar status mengendalikan seluruh katalog tokomu. Saat offline, produk tidak muncul di pencarian dan pesanan baru ditahan — tapi pesanan yang sedang berjalan tetap bisa diselesaikan."
          meta={
            <>
              <TierBadge tier={dashboard.tier} />
              {dashboard.hasExpressBadge ? (
                <Badge tone="astra" icon={<IconBolt size={12} />}>
                  Badge Kilat 10 Menit
                </Badge>
              ) : null}
              <LivePill tone={kyc.tone} label={kyc.label} />
            </>
          }
          actions={
            <ButtonLink
              href="/katalog"
              variant="secondary"
              trailingIcon={<IconArrowRight size={15} />}
              iconCircleClassName="bg-canvas"
            >
              Lihat katalog sebagai pembeli
            </ButtonLink>
          }
        />

        <SellerSection
          title="Status toko"
          description="Bertahan sampai kamu matikan sendiri — tersimpan di server, bukan di peramban."
        >
          {isAdminPreview ? (
            <div className="rounded-2xl bg-canvas px-4 py-3 text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line">
              Sakelar online dinonaktifkan dalam mode preview admin.
            </div>
          ) : (
            <OnlineToggle online={dashboard.isOnline} />
          )}
        </SellerSection>

        <SellerStats
          stats={{
            weekSeries: dashboard.weekSeries,
            weekLabels: dashboard.weekLabels,
            completedToday: dashboard.completedToday,
            ordersTotal: dashboard.ordersTotal,
            rating: dashboard.rating,
            reviewCount: dashboard.reviewCount,
          }}
        />

        <SellerGrid>
          <SellerStack>
            <SellerSection
              title="Pesanan berjalan"
              description="Antrean yang menunggu tindakanmu, lengkap dengan jam SLA berjalan."
              action={
                <Link
                  href="/dashboard/penjual/pesanan"
                  className="text-[11px] font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                >
                  Semua pesanan
                </Link>
              }
            >
              {activeOrders.length === 0 ? (
                <p className="text-[12.5px] text-ink-mute">
                  Belum ada pesanan aktif. Begitu ada checkout, pesanan muncul di sini.
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-hairline">
                  {activeOrders.map((order) => (
                    <ActiveOrderRow key={order.id} order={order} />
                  ))}
                </div>
              )}
            </SellerSection>

            {poolOrders.length > 0 ? (
              <SellerSection
                title="Order rebutan"
                description="Pesanan lunas yang belum diambil penjual mana pun. Siapa cepat, dia dapat."
                action={
                  <Link
                    href="/dashboard/penjual/order-robux"
                    className="text-[11px] font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                  >
                    Buka papan rebutan
                  </Link>
                }
              >
                <div className="flex flex-col divide-y divide-hairline">
                  {poolOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/pesanan/${order.code}`}
                      className="group flex items-center gap-4 py-3.5 first:pt-0"
                    >
                      <ProductArt
                        seed={order.productSlug ?? order.code}
                        category={order.category ?? ("roblox" as CategorySlug)}
                        className="size-11 shrink-0 rounded-xl outline outline-1 -outline-offset-1 outline-line-strong"
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-[12.5px] text-ink transition-colors group-hover:text-astra-ink">
                          {order.productTitle}
                        </span>
                        <span className="num text-[10px] text-ink-mute">
                          {order.code} · @{order.robloxUsername ?? "—"}
                        </span>
                      </div>
                      <StatusPill state={order.state} />
                      <span className="num w-24 shrink-0 text-right text-[12px] text-ink-dim">
                        {formatIDR(order.total)}
                      </span>
                    </Link>
                  ))}
                </div>
              </SellerSection>
            ) : null}
          </SellerStack>

          <SellerStack>
            <VolumeCap
              todayVolume={dashboard.todayVolume}
              dailyCap={dashboard.dailyCap}
              tier={dashboard.tier}
            />

            <SellerSection
              title="Saldo toko"
              description="Dana escrow dilepas ke dompet setelah pembeli mengonfirmasi."
              action={
                <Link
                  href="/dashboard/penjual/dompet"
                  className="text-[11px] font-bold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
                >
                  Tarik dana
                </Link>
              }
            >
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-ink-mute">Siap ditarik</dt>
                  <dd className="num text-[15px] font-extrabold text-ink">
                    {formatIDR(dashboard.wallet.balanceAvailable)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-ink-mute">Tertahan escrow</dt>
                  <dd className="num text-[12.5px] text-ink-dim">
                    {formatIDR(dashboard.wallet.balanceLocked)}
                  </dd>
                </div>
                {dashboard.pendingWithdrawals > 0 ? (
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[11px] text-ink-mute">Penarikan menunggu</dt>
                    <dd className="num text-[12.5px] text-ink-dim">
                      {dashboard.pendingWithdrawals} permintaan
                    </dd>
                  </div>
                ) : null}
              </dl>
            </SellerSection>

            <SellerSection title="Kesehatan serah terima">
              <dl className="flex flex-col gap-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-ink-mute">Rata-rata serah terima</dt>
                  <dd className="num text-[12.5px] font-bold text-astra-ink">
                    {formatDuration(dashboard.avgDeliverySeconds)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-ink-mute">Rasio sengketa</dt>
                  <dd className="num text-[12.5px] font-bold text-ink-dim">
                    {dashboard.disputeRatePercent.toFixed(2).replace(".", ",")}%
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[11px] text-ink-mute">Pesanan selesai</dt>
                  <dd className="num text-[12.5px] text-ink-dim">
                    {dashboard.ordersCompleted}
                  </dd>
                </div>
              </dl>
              <Notice tone="info" icon={<IconTimer size={15} />}>
                {dashboard.avgDeliverySeconds <= EXPRESS_SLA_SECONDS
                  ? `Rata-rata ${formatDuration(dashboard.avgDeliverySeconds)} — di bawah ambang ${EXPRESS_SLA_SECONDS / 60} menit, syarat Badge Kilat terpenuhi.`
                  : `Rata-rata ${formatDuration(dashboard.avgDeliverySeconds)} — turunkan ke bawah ${EXPRESS_SLA_SECONDS / 60} menit untuk memenuhi syarat Badge Kilat.`}
              </Notice>
            </SellerSection>

            <SellerSection title="Verifikasi identitas">
              {dashboard.kycVerified ? (
                <Notice tone="astra" icon={<IconShieldCheck size={15} />} title="KYC terverifikasi">
                  Identitas toko sudah disetujui admin dan tercatat di log audit.
                </Notice>
              ) : dashboard.kycStatus === "rejected" ? (
                <Notice
                  tone="danger"
                  icon={<IconShieldCheck size={15} />}
                  title="KYC ditolak — jualan dikunci"
                >
                  Listing, toko online, dan pool rebutan dinonaktifkan sampai identitasmu disetujui.
                  Perbaiki berkas di halaman Pengaturan.
                </Notice>
              ) : (
                <Notice
                  tone="warn"
                  icon={<IconShieldCheck size={15} />}
                  title="KYC menunggu verifikasi"
                >
                  Selama menunggu review admin, listing dan toko online dikunci.
                </Notice>
              )}
              {!dashboard.kycVerified ? (
                <ButtonLink
                  href="/dashboard/penjual/pengaturan"
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  trailingIcon={<IconArrowRight size={14} />}
                  iconCircleClassName="bg-canvas"
                >
                  {dashboard.kycStatus === "rejected" ? "Ajukan ulang KYC" : "Buka pengaturan"}
                </ButtonLink>
              ) : null}
            </SellerSection>
          </SellerStack>
        </SellerGrid>

        <SellerSection title="Jalan pintas">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                href: "/dashboard/penjual/listing",
                icon: <IconPackage size={16} />,
                label: "Listing & stok",
                hint: "Tambah produk, atur harga, jeda tayang",
              },
              {
                href: "/dashboard/penjual/dompet",
                icon: <IconWallet size={16} />,
                label: "Dompet & penarikan",
                hint: "Riwayat mutasi dan permintaan tarik dana",
              },
              {
                href: "/dashboard/penjual/pengaturan",
                icon: <IconSliders size={16} />,
                label: "Pengaturan toko",
                hint: "KYC, webhook Discord, info toko",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col gap-3 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:bg-paper hover:outline-astra/30"
              >
                <span className="flex items-center gap-2.5 text-astra-ink">
                  {item.icon}
                  <span className="font-display text-[13.5px] font-extrabold text-ink">
                    {item.label}
                  </span>
                </span>
                <span className="text-[11.5px] leading-relaxed text-ink-mute">{item.hint}</span>
                <span className="mt-auto flex items-center gap-1.5 text-[11px] font-extrabold text-astra-ink">
                  Buka
                  <IconArrowRight
                    size={12}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            ))}
          </div>
        </SellerSection>

        <p className="flex items-center gap-2 text-[11px] text-ink-mute">
          <IconStorefront size={13} />
          {dashboard.handle ? (
            <Link
              href={`/katalog?penjual=${dashboard.handle}`}
              className="font-semibold text-ink-dim underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
            >
              Lihat @{dashboard.handle} sebagai pembeli
            </Link>
          ) : (
            "Toko belum punya handle"
          )}
        </p>
      </SellerStack>
    </div>
  );
}
