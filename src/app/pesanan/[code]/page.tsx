import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { requireUser } from "@/lib/auth";
import { getOrderChatPresence, getOrderRoom, getOrderMessages, getOrderReview } from "@/lib/orders";
import { orderStates } from "@/lib/order-meta";
import { formatIDR, formatDateTime } from "@/lib/format";
import { Badge, LivePill, TierBadge } from "@/components/ui/badge";
import { Notice } from "@/components/ui/feedback";
import { ProductArt, SellerAvatar, StarRating } from "@/components/ui/art";
import { StateStepper } from "@/components/order/state-stepper";
import { OrderRoom } from "@/components/order/order-room";
import { RobloxDestination } from "@/components/order/roblox-destination";
import {
  IconArrowRight,
  IconBolt,
  IconChevronRight,
  IconInfo,
  IconPackage,
  IconReceipt,
  IconRefresh,
  IconShieldCheck,
} from "@/components/ui/icons";

export async function generateMetadata(props: PageProps<"/pesanan/[code]">): Promise<Metadata> {
  await connection();
  const { code } = await props.params;
  const user = await requireUser();
  const order = await getOrderRoom(code, { id: user.id, role: user.role });
  if (!order) return { title: "Pesanan tidak ditemukan" };
  return {
    title: `Pesanan ${order.code}`,
    description: `Pantau dana ditahan, chat penjual, dan status pengiriman untuk ${order.productTitle}.`,
    robots: { index: false, follow: false },
  };
}

export default function OrderDetailPage(props: PageProps<"/pesanan/[code]">) {
  return (
    <Suspense
      fallback={
        <div className="shell pb-24 pt-24 md:pt-28">
          <div className="h-40 animate-pulse rounded-card bg-canvas" />
        </div>
      }
    >
      <OrderDetailContent params={props.params} />
    </Suspense>
  );
}

async function OrderDetailContent({ params }: { params: Promise<{ code: string }> }) {
  // Read the request first: the session cookie is request-time data, and
  // touching it before opting out of the prerender trips cacheComponents.
  await connection();
  const { code } = await params;
  const user = await requireUser();
  const order = await getOrderRoom(code, { id: user.id, role: user.role });
  if (!order) notFound();
  const [messages, review, presence] = await Promise.all([
    getOrderMessages(order.id),
    getOrderReview(order.id),
    getOrderChatPresence(order.id),
  ]);

  const stateMeta = orderStates[order.state];
  const releaseAt = order.autoReleaseAt;

  const tone =
    order.state === "disputed"
      ? "danger"
      : order.state === "processing" || order.state === "paid"
        ? "astra"
        : order.state === "shipped"
          ? "robux"
          : "neutral";

  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
        <Link href="/pesanan" className="transition-colors hover:text-ink">
          Pesanan
        </Link>
        <IconChevronRight size={12} />
        <span className="num text-ink-dim">{order.code}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="num text-[11px] text-ink-mute">{order.code}</span>
              <LivePill tone={tone} label={stateMeta.label} />
              {order.expressBadge ? (
                <Badge tone="astra" icon={<IconBolt size={11} />}>
                  Kilat 10 Menit
                </Badge>
              ) : null}
              {order.isPoolOrder ? <Badge tone="info">Diklaim dari pool</Badge> : null}
            </div>

 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
              {order.productTitle}
            </h1>

            <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
              {stateMeta.buyerHint}
            </p>
          </div>

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-5 p-5">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconReceipt size={16} className="text-astra-ink" />
                Siklus hidup pesanan
              </span>
              <StateStepper state={order.state} timeline={order.timeline} />
            </div>
          </div>

          <Suspense fallback={<div className="h-40 animate-pulse rounded-card bg-canvas" />}>
            <OrderRoom order={order} messages={messages} review={review} presence={presence} />
          </Suspense>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-28">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-3.5 p-5">
              <span className="eyebrow text-ink-mute">
                Rincian dana
              </span>
              <div className="flex items-center gap-3.5">
                <ProductArt
                  seed={order.productSlug ?? order.code}
                  category={order.categorySlug ?? "item"}
                  className="size-16 shrink-0 rounded-well outline outline-1 -outline-offset-1 outline-line-strong"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-[12px] text-ink-dim">
                    {order.categoryName ?? "Pesanan Robux"}
                  </span>
                  {order.robloxUsername ? (
                    <RobloxDestination username={order.robloxUsername} />
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                {[
                  { label: "Harga produk", value: formatIDR(order.unitPrice) },
                  { label: "Komisi platform", value: formatIDR(order.platformFee) },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-mute">{row.label}</span>
                    <span className="num text-ink-dim">{row.value}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-line pt-2.5">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-ink-mute">
                    Ditahan platform
                  </span>
                  <span className="num text-base font-extrabold text-astra-ink">
                    {formatIDR(order.total)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 border-t border-line pt-4">
                <span className="flex items-center justify-between text-[11px] text-ink-mute">
                  Pelepasan otomatis
                  <span className="num text-ink-dim">
                    {releaseAt ? formatDateTime(releaseAt) : "—"}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-[11px] text-ink-mute">
                  <IconShieldCheck size={13} className="text-astra-ink" />
                  Dana ditahan sejak {formatDateTime(order.createdAtFull)}
                </span>
              </div>
            </div>
          </div>

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <SellerAvatar
                  name={order.sellerStoreName}
                  size={40}
                  online={order.sellerIsOnline}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-bold text-ink">
                    {order.sellerStoreName}
                  </span>
                  <StarRating
                    rating={order.sellerRating}
                    count={order.sellerReviewCount}
                    size={10}
                  />
                </div>
              </div>
              <TierBadge tier={order.sellerTier} />
              <div className="flex flex-col gap-2 border-t border-line pt-4">
                {[
                  {
                    label: "Serah terima rata-rata",
                    value: `${Math.max(1, Math.round(order.sellerAvgDeliverySeconds / 60))} menit`,
                  },
                  {
                    label: "Order selesai",
                    value: order.sellerOrdersCompleted.toLocaleString("id-ID"),
                  },
                  {
                    label: "Rasio sengketa",
                    value: `${order.sellerDisputeRatePercent.toFixed(2).replace(".", ",")}%`,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-mute">{row.label}</span>
                    <span className="num text-ink-dim">{row.value}</span>
                  </div>
                ))}
              </div>
              {order.productSlug ? (
                <Link
                  href={`/produk/${order.productSlug}`}
                  className="flex items-center justify-between rounded-well bg-canvas px-4 py-3 text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink"
                >
                  Lihat listing penjual
                  <IconArrowRight size={15} />
                </Link>
              ) : null}
            </div>
          </div>

          <Notice tone="info" icon={<IconInfo size={15} />} title="Aturan komunikasi platform">
            Semua koordinasi wajib di ruang pesanan ini. Blox Astra tidak menerima bukti chat dari
            aplikasi lain saat proses mediasi.
          </Notice>

          <div className="flex flex-col gap-3 rounded-card bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
            <span className="flex items-center gap-2 text-[12px] font-bold text-ink">
              <IconPackage size={15} className="text-ink-dim" />
              Logistik kategori
            </span>
            <p className="text-[11px] leading-relaxed text-ink-mute">
              {order.categoryFulfillment ??
                "Serah terima mengikuti wizard langkah demi langkah dan wajib diatapi Parental PIN."}
            </p>
            <span className="flex items-center gap-2 text-[11px] text-ink-mute">
              <IconRefresh size={13} />
              Sistem memeriksa status pesanan secara berkala
            </span>
          </div>
        </aside>
      </div>
    </div>
  );
}
