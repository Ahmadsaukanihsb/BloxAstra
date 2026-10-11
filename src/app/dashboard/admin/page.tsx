import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { cx } from "@/lib/cx";
import { formatDateTime, formatIDR, formatNumber } from "@/lib/format";
import type { OrderState } from "@/lib/types";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { AdminSellerActivator } from "@/components/admin/admin-seller-activator";
import { KycQueue, type KycQueueRow } from "@/components/admin/kyc-queue";
import { StatusPill } from "@/components/order/runtime";
import {
  IconArrowRight,
  IconCrown,
  IconReceipt,
  IconShieldCheck,
  IconStorefront,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Super dashboard",
  description: "Navigasi cepat ke panel admin dan preview dashboard penjual.",
  robots: { index: false, follow: false },
};

export default function SuperDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="shell pb-20 pt-8 md:pt-10">
          <Skeleton className="h-9 w-56" />
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        </div>
      }
    >
      <SuperDashboardContent />
    </Suspense>
  );
}

async function SuperDashboardContent() {
  await connection();
  const user = await requireRole("admin");

  const [
    users,
    sellers,
    products,
    orders,
    disputes,
    pendingWithdrawals,
    kycPending,
    adminHasSellerProfile,
    kycUsers,
    recentOrders,
  ] = await Promise.all([
    db.user.count(),
    db.sellerProfile.count(),
    db.product.count(),
    db.order.count(),
    db.dispute.count({ where: { status: "open" } }),
    db.withdrawal.count({ where: { status: "pending" } }),
    db.user.count({ where: { kycStatus: "pending" } }),
    db.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
    db.user.findMany({
      where: { kycStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        whatsapp: true,
        createdAt: true,
        sellerProfile: {
          select: {
            storeName: true,
            tier: true,
            fullName: true,
            idCardImage: true,
            selfieImage: true,
          },
        },
      },
    }),
    db.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        code: true,
        status: true,
        total: true,
        kind: true,
        robuxAmount: true,
        createdAt: true,
        product: { select: { title: true } },
        buyer: { select: { username: true } },
        seller: { select: { storeName: true } },
      },
    }),
  ]);

  const kycRows: KycQueueRow[] = kycUsers.map((row) => ({
    userId: row.id,
    username: row.username,
    email: row.email,
    whatsapp: row.whatsapp,
    joinedAt: row.createdAt.toISOString(),
    storeName: row.sellerProfile?.storeName ?? null,
    tier: row.sellerProfile?.tier ?? null,
    fullName: row.sellerProfile?.fullName ?? null,
    idCardImage: row.sellerProfile?.idCardImage ?? null,
    selfieImage: row.sellerProfile?.selfieImage ?? null,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [todayVolume, todayOrders] = await Promise.all([
    db.order.aggregate({
      where: { status: { notIn: ["cancelled", "refunded"] }, createdAt: { gte: today } },
      _sum: { total: true },
    }),
    db.order.count({ where: { createdAt: { gte: today } } }),
  ]);

  const navCards = [
    {
      href: "/admin",
      icon: <IconShieldCheck size={22} className="text-astra-ink" />,
      title: "Panel Admin",
      desc: "Arbitrase sengketa, escrow, payout manual, log audit, dan pengaturan rate.",
    },
    {
      href: "/dashboard/penjual",
      icon: <IconStorefront size={22} className="text-astra-ink" />,
      title: "Preview Dashboard Penjual",
      desc: "Lihat tampilan dashboard penjual, stok, performa, dan saldo escrow.",
    },
  ];

  const attention = [
    {
      href: "#kyc-queue",
      count: kycPending,
      label: "KYC menunggu verifikasi",
      desc: "Pendaftaran penjual baru menunggu persetujuan atau penolakan.",
      tone: "danger" as const,
    },
    {
      href: "/admin?tab=tarik",
      count: pendingWithdrawals,
      label: "Penarikan menunggu",
      desc: "Pengajuan penarikan saldo penjual menunggu cair atau tolak.",
      tone: "warn" as const,
    },
    {
      href: "/admin?tab=sengketa",
      count: disputes,
      label: "Sengketa terbuka",
      desc: "Arbitrase pesanan yang disengketakan pembeli menunggu putusan.",
      tone: "danger" as const,
    },
  ];

  return (
    <div className="shell pb-20 pt-8 md:pt-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex items-center gap-2 text-[13px] text-ink-mute">
              <IconCrown size={16} className="text-astra-ink" />
              Super dashboard
            </span>
          </div>
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
            Halo, {user.username}
          </h1>
          <p className="max-w-[64ch] text-[13px] leading-relaxed text-ink-dim">
            Navigasi cepat ke semua panel operasional Blox Astra.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-4">
          <StatCard label="Pengguna" value={formatNumber(users)} />
          <StatCard label="Penjual" value={formatNumber(sellers)} />
          <StatCard label="Produk" value={formatNumber(products)} />
          <StatCard label="Pesanan" value={formatNumber(orders)} />
        </div>

        <section className="flex flex-col gap-3.5">
 <h2 className="eyebrow text-ink-mute">
            Perlu perhatian
          </h2>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
            {attention.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="group bezel-shell p-1.5 transition-colors duration-300 hover:bg-astra/[0.03]"
              >
                <div className="bezel-core flex flex-col gap-3 p-5">
                  <div className="flex items-center justify-between">
                    <span
                      className={cx(
                        "num text-[26px] font-extrabold leading-none",
                        item.count > 0
                          ? item.tone === "danger"
                            ? "text-danger"
                            : "text-warn"
                          : "text-ink-mute",
                      )}
                    >
                      {item.count}
                    </span>
                    <IconArrowRight
                      size={18}
                      className="text-ink-mute transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[13px] font-bold text-ink">{item.label}</span>
                    <span className="text-[12px] leading-relaxed text-ink-dim">{item.desc}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {!adminHasSellerProfile ? (
          <div className="bezel-shell bg-astra/[0.03] p-1.5">
            <div className="bezel-core flex flex-col gap-3 p-5">
              <span className="text-[13px] font-bold text-ink">Aktifkan akun penjual untuk preview</span>
              <p className="text-[12px] leading-relaxed text-ink-dim">
                Admin belum memiliki profil penjual. Aktifkan mode penjual agar dashboard penjual bisa
                dilihat dengan data nyata.
              </p>
              <AdminSellerActivator />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          {navCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group bezel-shell p-1.5 transition-colors duration-300 hover:bg-astra/[0.03]"
            >
              <div className="bezel-core flex flex-col gap-4 p-5">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-control bg-astra/10">{card.icon}</span>
                  <IconArrowRight
                    size={18}
                    className="text-ink-mute transition-transform duration-300 group-hover:translate-x-1"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] font-bold text-ink">{card.title}</span>
                  <span className="text-[12px] leading-relaxed text-ink-dim">{card.desc}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section id="kyc-queue" className="flex scroll-mt-24 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
 <h2 className="eyebrow text-ink-mute">
                Antrean KYC penjual
              </h2>
              <span
                className={cx(
                  "num rounded-full px-2 py-0.5 text-[10px] font-extrabold",
                  kycPending > 0 ? "bg-danger/15 text-danger" : "bg-canvas text-ink-mute",
                )}
              >
                {kycPending}
              </span>
            </div>
          </div>
          <KycQueue rows={kycRows} total={kycPending} />
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
 <h2 className="eyebrow text-ink-mute">
              Pesanan terbaru
            </h2>
            <Link
              href="/pesanan"
              className="text-[12px] font-bold text-astra-ink transition-colors duration-200 hover:text-ink"
            >
              Buka semua pesanan →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <EmptyState
              icon={<IconReceipt size={22} />}
              title="Belum ada pesanan"
              description="Pesanan baru dari pembeli akan muncul di sini secara langsung."
            />
          ) : (
            <div className="flex flex-col gap-2">
              {recentOrders.map((order) => (
                <Link
                  key={order.code}
                  href={`/pesanan/${order.code}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-well bg-canvas px-4 py-3.5 outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:bg-canvas-2"
                >
                  <StatusPill state={order.status as OrderState} />
                  <span className="num text-[13px] font-bold text-ink">{order.code}</span>
                  <span className="min-w-[140px] flex-1 truncate text-[12px] text-ink-dim">
                    {recentOrderTitle(order)}
                  </span>
                  <span className="text-[11px] text-ink-mute">
                    {order.buyer.username} → {order.seller?.storeName ?? "antrean pool"}
                  </span>
                  <span className="num text-[13px] font-extrabold text-astra-ink">
                    {formatIDR(order.total)}
                  </span>
                  <span className="num text-[11px] text-ink-mute">
                    {formatDateTime(order.createdAt.toISOString())}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-4 p-5">
              <span className="text-[13px] font-bold text-ink">Ringkasan hari ini</span>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink-mute">Volume bersih</span>
                <span className="num font-bold text-astra-ink">{formatIDR(todayVolume._sum.total ?? 0)}</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink-mute">Pesanan masuk</span>
                <span className="num font-bold text-ink">{formatNumber(todayOrders)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type RecentOrder = {
  code: string;
  status: string;
  total: number;
  kind: string;
  robuxAmount: number | null;
  createdAt: Date;
  product: { title: string } | null;
  buyer: { username: string };
  seller: { storeName: string } | null;
};

function recentOrderTitle(order: RecentOrder): string {
  if (order.product?.title) return order.product.title;
  if (order.kind === "premium") return "Roblox Premium";
  if (order.robuxAmount && order.kind.startsWith("robux")) {
    return `${formatNumber(order.robuxAmount)} Robux`;
  }
  return order.kind === "catalog" ? "Pesanan katalog" : "Pesanan";
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-2 p-5">
        <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">{label}</span>
        <span className="num text-[22px] font-extrabold text-astra-ink">{value}</span>
      </div>
    </div>
  );
}
