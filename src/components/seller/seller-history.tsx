"use client";

import { useState } from "react";
import Link from "next/link";
import { cx } from "@/lib/cx";
import { formatDateTime, formatIDR } from "@/lib/format";
import type { OrderListItem } from "@/lib/orders";
import { ACTIVE_ORDER_STATES } from "@/lib/order-meta";
import type { CategorySlug } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Countdown, StatusPill } from "@/components/order/runtime";
import { ProductArt } from "@/components/ui/art";
import { IconArrowRight, IconBolt, IconReceipt, IconTimer } from "@/components/ui/icons";

/** Active-order row for the seller dashboard: clickable + live SLA clock. */
export function ActiveOrderRow({ order }: { order: OrderListItem }) {
  const sla = order.slaRemainingSeconds;
  const expired = sla !== null && sla <= 0;
  const urgent = sla !== null && sla > 0 && sla <= 300;
  return (
    <Link
      href={`/pesanan/${order.code}`}
      className="group flex items-center gap-4 py-3.5 first:pt-0"
    >
      <ProductArt
        seed={order.productSlug ?? order.code}
        category={order.category ?? ("roblox" as CategorySlug)}
        className="size-11 shrink-0 rounded-control outline outline-1 -outline-offset-1 outline-line-strong"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[12px] text-ink transition-colors group-hover:text-astra-ink">
          {order.productTitle}
        </span>
        <span className="num text-[10px] text-ink-mute">
          {order.code} · @{order.robloxUsername ?? "—"}
        </span>
        {sla !== null ? (
          <span
            className={cx(
              "flex items-center gap-1 text-[10px]",
              expired ? "font-bold text-danger" : urgent ? "font-bold text-warn" : "text-ink-mute",
            )}
          >
            <IconTimer size={11} />
            {expired ? (
              <>SLA lewat{order.slaLabel ? ` · ${order.slaLabel}` : null}</>
            ) : (
              <>
                <Countdown seconds={sla} className="text-[10px]" />
                {order.slaLabel ? <span>· {order.slaLabel}</span> : null}
              </>
            )}
          </span>
        ) : null}
      </div>
      <StatusPill state={order.state} />
      <span className="num w-24 shrink-0 text-right text-[12px] text-ink-dim">
        {formatIDR(order.total)}
      </span>
    </Link>
  );
}

type HistoryTab = "aktif" | "selesai" | "semua";

const HISTORY_TABS: { id: HistoryTab; label: string }[] = [
  { id: "aktif", label: "Berjalan" },
  { id: "selesai", label: "Selesai" },
  { id: "semua", label: "Semua" },
];

export function SellerHistory({
  orders,
  completedCount,
}: {
  orders: OrderListItem[];
  completedCount: number;
}) {
  const [tab, setTab] = useState<HistoryTab>("semua");

  const filtered = orders.filter((order) => {
    if (tab === "semua") return true;
    const active = ACTIVE_ORDER_STATES.includes(order.state);
    return tab === "aktif" ? active : !active;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] font-bold text-ink">Riwayat pesanan toko</span>
        <span className="num text-[11px] text-ink-mute">{completedCount} selesai</span>
      </div>

      <div className="flex gap-1.5 rounded-full bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line">
        {HISTORY_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cx(
              "flex-1 rounded-full px-4 py-2 text-[12px] font-bold transition-colors duration-300",
              tab === item.id
                ? "bg-astra text-white"
                : "text-ink-dim outline outline-1 -outline-offset-1 outline-transparent hover:text-ink",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<IconReceipt size={22} />}
          title={tab === "aktif" ? "Tidak ada pesanan berjalan" : "Belum ada riwayat"}
          description="Pesanan yang kamu ambil dari pool rebutan atau dari katalog akan muncul di sini beserta status escrow-nya."
        />
      ) : (
        <div className="flex flex-col divide-y divide-line rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          {filtered.map((order) => (
            <Link
              key={order.id}
              href={`/pesanan/${order.code}`}
              className="group flex flex-wrap items-center gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <span className="num text-[11px] text-ink-mute">{order.code}</span>
              <StatusPill state={order.state} />
              {order.expressBadge ? (
                <Badge tone="astra" icon={<IconBolt size={11} />}>
                  Kilat
                </Badge>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">
                {order.productTitle}
                {order.robloxUsername ? (
                  <span className="num text-ink-mute"> · @{order.robloxUsername}</span>
                ) : null}
              </span>
              <span className="num text-[12px] font-extrabold text-ink">
                {formatIDR(order.total)}
              </span>
              <span className="num text-[10px] text-ink-mute">{formatDateTime(order.createdAt)}</span>
              <IconArrowRight
                size={13}
                className="text-ink-mute transition-colors duration-300 group-hover:text-astra-ink"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
