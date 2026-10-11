"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatIDR, formatIDRCompact, formatNumber } from "@/lib/format";
import { cx } from "@/lib/cx";
import { Badge, LivePill, TierBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/feedback";
import { setSellerOnline } from "@/app/actions/seller";
import { WithdrawDialog } from "@/components/seller/withdraw-dialog";
import {
  IconArrowRight,
  IconChartBars,
  IconShieldCheck,
  IconTimer,
  IconWallet,
} from "@/components/ui/icons";

type Heartbeat = "idle" | "saving" | "error";

export function OnlineToggle({ online }: { online: boolean }) {
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(online);
  const [state, setState] = useState<Heartbeat>("idle");
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !isOnline;
    setIsOnline(next);
    setState("saving");
    startTransition(async () => {
      const result = await setSellerOnline(next);
      if (!result.ok) {
        setIsOnline(!next);
        setState("error");
        return;
      }
      setState("idle");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={isOnline}
        disabled={isPending}
        onClick={toggle}
        className={cx(
          "group flex items-center gap-3 rounded-full p-1.5 pl-4 outline outline-1 -outline-offset-1 transition-colors duration-500 ease-[var(--ease-astra)]",
          isOnline
            ? "bg-astra/[0.08] outline-astra/25"
            : "bg-canvas outline-line",
        )}
      >
        <span className="flex items-center gap-2.5">
          <LivePill
            tone={isOnline ? "astra" : "neutral"}
            label={isOnline ? "Siap Kirim" : "Istirahat"}
          />
          <span className="hidden text-[11px] text-ink-mute sm:block">
            {state === "saving"
              ? "menyimpan…"
              : state === "error"
                ? "gagal menyimpan, coba lagi"
                : isOnline
                  ? "produk tampil di katalog"
                  : "produk disembunyikan"}
          </span>
        </span>
        <span
          className={cx(
            "relative grid h-8 w-14 shrink-0 items-center rounded-full transition-colors duration-500 ease-[var(--ease-astra)]",
            isOnline ? "bg-astra" : "bg-canvas-2",
          )}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cx(
              "absolute size-6 rounded-full bg-white shadow-[0_1px_3px_rgba(16,24,40,0.3)]",
              isOnline ? "right-1" : "left-1",
            )}
          />
        </span>
      </button>
      <span className="flex items-center gap-2 text-[11px] text-ink-mute">
        <IconTimer size={13} />
        status tersimpan di server · bertahan sampai kamu matikan sendiri
      </span>
    </div>
  );
}

/**
 * The strip deliberately shows only numbers that appear nowhere else on the
 * Ringkasan page. Volume, delivery speed, dispute rate and the daily ceiling
 * all have their own block below, so repeating them here just made the page
 * look fuller without adding information.
 */
export interface SellerStatsData {
  weekSeries: number[];
  weekLabels: string[];
  completedToday: number;
  /** every order ever routed to this seller, any status */
  ordersTotal: number;
  rating: number;
  reviewCount: number;
}

export function SellerStats({ stats }: { stats: SellerStatsData }) {
  const weekOrders = stats.weekSeries.reduce((total, value) => total + value, 0);
  const peakOrders = Math.max(...stats.weekSeries, 0);
  const peakIndex = stats.weekSeries.indexOf(peakOrders);
  const peakLabel = peakIndex >= 0 ? stats.weekLabels[peakIndex] : "—";
  const max = Math.max(...stats.weekSeries, 1);
  const dayCount = stats.weekSeries.length || 7;
  const perDay = Math.round(weekOrders / dayCount);
  // The 7-day window in lib/seller.ts ends today, so the last bucket is today.
  const ordersToday = stats.weekSeries[dayCount - 1] ?? 0;
  const hasReviews = stats.reviewCount > 0;

  const metrics: { label: string; value: string; note: string; tone?: "ink" | "astra" }[] = [
    {
      label: "Pesanan masuk hari ini",
      value: formatNumber(ordersToday),
      note: `${formatNumber(stats.completedToday)} selesai hari ini`,
    },
    {
      label: "Pesanan 7 hari",
      value: formatNumber(weekOrders),
      note: `rata-rata ${formatNumber(perDay)} per hari`,
    },
    {
      label: "Penilaian toko",
      value: hasReviews ? `${stats.rating.toFixed(1).replace(".", ",")} / 5` : "—",
      note: hasReviews ? `${formatNumber(stats.reviewCount)} ulasan pembeli` : "belum ada ulasan",
      tone: hasReviews ? "astra" : "ink",
    },
    {
      label: "Pesanan sepanjang waktu",
      value: formatNumber(stats.ordersTotal),
      note: "termasuk yang dibatalkan & direfund",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="flex flex-col gap-3 rounded-[1.5rem] bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line"
          >
            <span className="text-[10px] leading-snug uppercase tracking-[0.16em] text-ink-mute">
              {metric.label}
            </span>
            <span
              className={cx(
                "num text-[24px] font-extrabold leading-none",
                metric.tone === "astra" ? "text-astra-ink" : "text-ink",
              )}
            >
              {metric.value}
            </span>
            <span className="mt-auto border-t border-hairline pt-3 text-[11px] leading-relaxed text-ink-mute">
              {metric.note}
            </span>
          </div>
        ))}
      </div>

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
              <IconChartBars size={16} className="text-astra-ink" />
              Volume pesanan 7 hari terakhir
            </span>
            <Badge tone="astra">
              Puncak {peakLabel} · {peakOrders} order
            </Badge>
          </div>

          <div className="grid h-40 grid-cols-7 items-end gap-2.5">
            {stats.weekSeries.map((value, index) => (
              <div key={stats.weekLabels[index] ?? index} className="flex h-full flex-col justify-end gap-2">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(value / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className={cx(
                    "w-full rounded-t-xl",
                    value === peakOrders && peakOrders > 0 ? "bg-astra" : "bg-astra/25",
                  )}
                />
                <span className="num text-center text-[10px] text-ink-mute">
                  {stats.weekLabels[index]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function VolumeCap({
  todayVolume,
  dailyCap,
  tier,
}: {
  todayVolume: number;
  dailyCap: number;
  tier: 1 | 2 | 3;
}) {
  const ratio = dailyCap > 0 ? todayVolume / dailyCap : 0;

  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <IconShieldCheck size={16} className="text-astra-ink" />
          Plafon penjualan hari ini
        </span>
        <TierBadge tier={tier} />
      </div>

      <ProgressBar value={ratio} tone={ratio > 0.85 ? "danger" : "astra"} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px]">
        <span className="num text-ink-dim">
          {formatIDR(todayVolume)} / {formatIDR(dailyCap)}
        </span>
        <span className="num text-ink-mute">
          sisa {formatIDRCompact(Math.max(0, dailyCap - todayVolume))}
        </span>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-mute">
        Plafon harian mengikuti tier tokomu dan berlaku untuk seluruh penjualan hari ini.
        Peningkatan tier beserta plafonnya ditinjau admin berdasarkan performa toko — bukan
        otomatis.
      </p>
    </div>
  );
}

export function PayoutCard({
  balanceAvailable,
  balanceLocked,
  pendingWithdrawals,
  banks,
  minAmount,
  fee,
  canWithdraw = true,
}: {
  balanceAvailable: number;
  balanceLocked: number;
  pendingWithdrawals: number;
  banks: string[];
  minAmount: number;
  fee: number;
  canWithdraw?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-4 p-5">
        <span className="flex items-center gap-2 text-[13px] font-bold text-ink">
          <IconWallet size={16} className="text-astra-ink" />
          Saldo dompet
        </span>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Bisa ditarik
          </span>
          <span className="num text-[22px] font-extrabold text-astra-ink">
            {formatIDR(balanceAvailable)}
          </span>
        </div>

        <div className="flex flex-col gap-2 border-t border-hairline pt-4">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-ink-mute">Ditahan platform</span>
            <span className="num text-robux">{formatIDR(balanceLocked)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-ink-mute">Pencairan</span>
            <span className="num text-ink-dim">
              {pendingWithdrawals > 0
                ? `${pendingWithdrawals} penarikan menunggu admin`
                : "manual · disetujui admin"}
            </span>
          </div>
        </div>

        <Button
          fullWidth
          disabled={!canWithdraw || balanceAvailable <= 0}
          trailingIcon={<IconArrowRight size={15} />}
          iconCircleClassName="bg-white/20"
          onClick={() => setOpen(true)}
        >
          Tarik dana
        </Button>

        <WithdrawDialog
          open={open}
          onClose={() => setOpen(false)}
          balanceAvailable={balanceAvailable}
          banks={banks}
          minAmount={minAmount}
          fee={fee}
        />
      </div>
    </div>
  );
}
