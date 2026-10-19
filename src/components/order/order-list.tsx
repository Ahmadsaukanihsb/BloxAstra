"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { formatIDR, formatDateTime } from "@/lib/format";
import type { OrderListItem } from "@/lib/orders";
import { ACTIVE_ORDER_STATES } from "@/lib/order-meta";
import type { CategorySlug, OrderState } from "@/lib/types";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { ProductArt, SellerAvatar } from "@/components/ui/art";
import { Countdown, StatusPill } from "@/components/order/runtime";
import { orderStates } from "@/lib/order-meta";
import {
  IconArrowRight,
  IconBolt,
  IconChat,
  IconHexCoin,
  IconReceipt,
  IconShieldCheck,
  IconTimer,
} from "@/components/ui/icons";

type Tab = "aktif" | "selesai" | "semua";

// Money that actually moved: excludes unpaid bills and reversed orders.
const PAID_STATES: OrderState[] = [
  "paid",
  "processing",
  "shipped",
  "completed",
  "disputed",
];

export function OrderList({
  orders: allOrders,
  heldTotal,
  viewerRole,
}: {
  orders: OrderListItem[];
  heldTotal: number;
  viewerRole: "buyer" | "seller" | "admin";
}) {
  const [tab, setTab] = useState<Tab>("aktif");

  const activeOrders = allOrders.filter((order) => ACTIVE_ORDER_STATES.includes(order.state));
  const historyOrders = allOrders.filter((order) => !ACTIVE_ORDER_STATES.includes(order.state));
  const orders = tab === "aktif" ? activeOrders : tab === "selesai" ? historyOrders : allOrders;
  const paidTotal = allOrders
    .filter((order) => PAID_STATES.includes(order.state))
    .reduce((sum, order) => sum + order.total, 0);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "aktif", label: "Berjalan", count: activeOrders.length },
    { id: "selesai", label: "Riwayat", count: historyOrders.length },
    { id: "semua", label: "Semua", count: allOrders.length },
  ];

  return (
    <div className="shell pb-24 pt-10 md:pt-14">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconReceipt size={16} className="text-astra-ink" />
            Transaksi
          </span>
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
            Pesanan saya
          </h1>
          <p className="max-w-[62ch] text-[13px] leading-relaxed text-ink-dim">
            Setiap pesanan punya ruang chat sendiri dan status dana yang bisa dipantau sampai
            dana cair atau kembali.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconShieldCheck size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Ditahan platform
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {formatIDR(heldTotal)}
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Dana escrow pesanan berjalan
                </span>
              </span>
            </div>
          </div>
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconTimer size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Berjalan
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {activeOrders.length} pesanan
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Belum selesai, pantau SLA-nya
                </span>
              </span>
            </div>
          </div>
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-control bg-astra/10 text-astra-ink">
                <IconHexCoin size={16} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Total dibayar
                </span>
                <span className="num truncate text-[15px] font-extrabold text-ink">
                  {formatIDR(paidTotal)}
                </span>
                <span className="truncate text-[10px] text-ink-mute">
                  Di luar yang batal & refund
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex gap-1.5 rounded-full bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={cx(
                  "relative isolate flex-1 rounded-full px-4 py-2 text-[12px] font-bold transition-colors duration-300",
                  tab === item.id ? "text-white" : "text-ink-dim hover:text-ink",
                )}
              >
                {tab === item.id ? (
                  <motion.span
                    layoutId="order-tab"
                    transition={{ type: "spring", stiffness: 320, damping: 30 }}
                    className="absolute inset-0 -z-10 rounded-full bg-astra"
                  />
                ) : null}
                {item.label}{" "}
                <span className={cx("num", tab === item.id ? "opacity-80" : "text-ink-mute")}>
                  {item.count}
                </span>
              </button>
            ))}
          </div>

          {orders.length === 0 ? (
            <EmptyState
              icon={<IconReceipt size={22} />}
              title={
                tab === "aktif"
                  ? "Tidak ada pesanan berjalan"
                  : tab === "selesai"
                    ? "Belum ada riwayat pesanan"
                    : "Belum ada pesanan"
              }
              description="Jelajahi katalog untuk mulai transaksi pertama dengan penahanan dana platform."
              action={
                <ButtonLink href="/katalog" trailingIcon={<IconArrowRight size={15} />}>
                  Jelajahi katalog
                </ButtonLink>
              }
            />
          ) : (
            <div className="flex flex-col gap-3.5">
              <AnimatePresence initial={false} mode="popLayout">
                {orders.map((order) => (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <OrderRow order={order} viewerRole={viewerRole} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  viewerRole,
}: {
  order: OrderListItem;
  viewerRole: "buyer" | "seller" | "admin";
}) {
  const meta = orderStates[order.state as OrderState];
  const [slaExpired, setSlaExpired] = useState(false);
  const showCountdown =
    !slaExpired && order.slaRemainingSeconds !== null && ACTIVE_ORDER_STATES.includes(order.state);
  const hint =
    viewerRole === "buyer"
      ? meta.buyerHint
      : "Buka ruang pesanan untuk progres, chat, dan serah terima.";

  return (
    <Link
      href={`/pesanan/${order.code}`}
      className="group block rounded-card transition-transform duration-500 ease-[var(--ease-astra)] hover:-translate-y-0.5"
    >
      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="num text-[11px] font-bold text-ink-mute">{order.code}</span>
            <StatusPill state={order.state} />
            {order.expressBadge ? (
              <Badge tone="astra" icon={<IconBolt size={11} />}>
                Kilat 10 Menit
              </Badge>
            ) : null}
            {order.isPoolOrder ? <Badge tone="info">Pool order</Badge> : null}
            {order.unread > 0 ? (
              <Badge tone="astra" icon={<IconChat size={11} />}>
                {order.unread} pesan baru
              </Badge>
            ) : null}
            <span className="num ml-auto text-[11px] text-ink-mute">
              {formatDateTime(order.createdAt)}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ProductArt
              seed={order.productSlug ?? order.code}
              category={(order.category ?? "item") as CategorySlug}
              className="size-[62px] shrink-0 rounded-well outline outline-1 -outline-offset-1 outline-line-strong"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="truncate text-[14px] font-bold text-ink">
                {order.productTitle}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <SellerAvatar name={order.sellerStore} size={22} imageUrl={order.sellerStoreImage} />
                <span className="text-[11px] text-ink-dim">{order.sellerStore}</span>
                {order.robloxUsername ? (
                  <span className="text-[11px] text-ink-mute">
                    tujuan <span className="num text-ink-dim">@{order.robloxUsername}</span>
                  </span>
                ) : null}
              </div>
              <span className="line-clamp-2 text-[11px] leading-relaxed text-ink-mute">
                {hint}
              </span>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="num text-[15px] font-extrabold text-ink">
                {formatIDR(order.total)}
              </span>
              {showCountdown ? (
                <Countdown
                  seconds={order.slaRemainingSeconds ?? 0}
                  onExpire={() => setSlaExpired(true)}
                />
              ) : slaExpired ? (
                <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                  <IconTimer size={13} />
                  SLA berakhir
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[11px] text-ink-mute">
                  <IconShieldCheck size={13} className="text-astra-ink" />
                  dana aman
                </span>
              )}
              <span className="flex items-center gap-1.5 text-[11px] text-ink-dim transition-colors duration-300 group-hover:text-astra-ink">
                Buka ruang pesanan
                <IconArrowRight size={13} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
