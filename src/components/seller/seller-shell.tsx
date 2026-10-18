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
              "absolute size-6 rounded-full bg-paper shadow-[0_1px_3px_rgba(16,24,40,0.3)]",
              isOnline ? "right-1" : "left-1",
            )}
          />
        </span>
      </button>
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
  const perDayRaw = weekOrders / dayCount;
  // Rounding to a whole number would print "rata-rata 0 per hari" for a store
  // with a handful of orders in the window; keep one decimal until it counts.
  const perDay = perDayRaw < 1 && weekOrders > 0 ? perDayRaw.toFixed(1).replace(".", ",") : formatNumber(Math.round(perDayRaw));
  // The 7-day window in lib/seller.ts ends today, so the last bucket is today.
  const ordersToday = stats.weekSeries[dayCount - 1] ?? 0;
  const hasReviews = stats.reviewCount > 0;

  /*
   * Two registers in one panel: today's queue at display scale — the number a
   * seller actually reacts to — then the slower signals as a quiet definition
   * list instead of four look-alike boxes. The bars print their own values and
   * give empty days a visible baseline, because a chart whose zero days render
   * as nothing reads as broken rather than as zero.
   */
  const slowSignals = [
    {
      label: "Penilaian toko",
      value: hasReviews ? `${stats.rating.toFixed(1).replace(".", ",")} / 5` : "—",
      note: hasReviews ? `${formatNumber(stats.reviewCount)} ulasan pembeli` : "belum ada ulasan",
      highlight: hasReviews,
    },
    {
      label: "Pesanan 7 hari",
      value: formatNumber(weekOrders),
      note: peakOrders > 0 ? `terbanyak ${peakLabel} · ${peakOrders} order` : "belum ada order",
      highlight: false,
    },
    {
      label: "Sepanjang waktu",
      value: formatNumber(stats.ordersTotal),
      note: "termasuk yang dibatalkan & direfund",
      highlight: false,
    },
  ];

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-6 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
            <IconChartBars size={16} className="text-astra-ink" />
            Ringkasan
          </span>
          {peakOrders > 0 ? (
            <Badge tone="astra">
              Puncak {peakLabel} · {peakOrders} order
            </Badge>
          ) : (
            <span className="text-[11px] text-ink-mute">
              {dayCount} hari terakhir · zona Asia/Jakarta
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-8">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-end gap-4">
              <span className="num text-[46px] font-extrabold leading-[0.85] text-ink">
                {formatNumber(ordersToday)}
              </span>
              <span className="flex flex-col gap-1.5 pb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-mute">
                  Pesanan masuk hari ini
                </span>
                <span className="text-[12px] text-ink-dim">
                  {formatNumber(stats.completedToday)} selesai hari ini
                </span>
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-7 gap-2">
                {stats.weekSeries.map((value, index) => (
                  <span
                    key={stats.weekLabels[index] ?? index}
                    className={cx(
                      "num text-center text-[10px]",
                      value > 0 ? "text-ink-dim" : "text-ink-mute/60",
                    )}
                  >
                    {value}
                  </span>
                ))}
              </div>

              <div className="grid h-24 grid-cols-7 items-end gap-2">
                {stats.weekSeries.map((value, index) => (
                  <motion.div
                    key={`bar-${stats.weekLabels[index] ?? index}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max((value / max) * 100, value > 0 ? 8 : 2)}%` }}
                    transition={{ duration: 0.7, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className={cx(
                      "w-full rounded-t-xl",
                      value === peakOrders && peakOrders > 0 ? "bg-astra" : value > 0 ? "bg-astra/30" : "bg-line",
                    )}
                  />
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {stats.weekLabels.map((label, index) => (
                  <span
                    key={`day-${label ?? index}`}
                    className={cx(
                      "num text-center text-[10px]",
                      index === dayCount - 1 ? "font-extrabold text-astra-ink" : "text-ink-mute",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-ink-mute">
                Rata-rata {perDay} pesanan per hari
                {peakOrders > 0 ? ` · puncak ${peakLabel} dengan ${peakOrders} pesanan` : ""}
              </p>
            </div>
          </div>

          <dl className="flex flex-col divide-y divide-line lg:border-l lg:border-line lg:pl-8">
            {slowSignals.map((signal) => (
              <div
                key={signal.label}
                className="flex items-baseline justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
              >
                <dt className="text-[11px] text-ink-mute">{signal.label}</dt>
                <dd className="flex flex-col items-end gap-1 text-right">
                  <span
                    className={cx(
                      "num text-[17px] font-extrabold leading-none",
                      signal.highlight ? "text-astra-ink" : "text-ink",
                    )}
                  >
                    {signal.value}
                  </span>
                  <span className="text-[10.5px] leading-relaxed text-ink-mute">{signal.note}</span>
                </dd>
              </div>
            ))}
          </dl>
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
    <div className="flex flex-col gap-4 rounded-card bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
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
        Peningkatan tier beserta plafonnya ditinjau manual berdasarkan performa toko,
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
      <div className="bezel-core flex flex-col gap-4 p-4">
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

        <div className="flex flex-col gap-2 border-t border-line pt-4">
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
          iconCircleClassName="bg-paper/20"
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
