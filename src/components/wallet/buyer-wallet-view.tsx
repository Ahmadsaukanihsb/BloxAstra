"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatIDR, formatDateTime } from "@/lib/format";
import type { WalletEntryView } from "@/lib/wallet";
import { reconcileTopUp } from "@/app/actions/topup";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { TopUpPanel } from "@/components/wallet/topup-panel";
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconClock,
  IconHexCoin,
  IconInfo,
  IconReceipt,
  IconRefresh,
  IconTrendUp,
  IconWallet,
} from "@/components/ui/icons";

export interface BuyerPendingTopUp {
  code: string;
  amount: number;
  fee: number;
  paymentMethod: string;
  checkoutUrl: string | null;
  expiresAt: string | null;
}

export interface BuyerWalletStats {
  totalTopUp: number;
  totalSpent: number;
  totalRefund: number;
}

const METHOD_LABEL: Record<string, string> = {
  qris: "QRIS",
  va: "Virtual Account",
  ewallet: "E-Wallet",
};

const TYPE_META: Record<string, { label: string; tone: "astra" | "danger" | "info" | "robux" }> = {
  topup: { label: "Top-up masuk", tone: "astra" },
  purchase: { label: "Belanja saldo", tone: "info" },
  refund: { label: "Refund masuk", tone: "robux" },
};

function PendingTopUpRow({ item }: { item: BuyerPendingTopUp }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function checkStatus() {
    setMessage(null);
    startTransition(async () => {
      const result = await reconcileTopUp(item.code);
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      if (result.credited) {
        setMessage({ ok: true, text: "Saldo masuk. Mutasi diperbarui." });
        router.refresh();
      } else {
        setMessage({ ok: false, text: "Belum ada pembayaran masuk. Selesaikan pembayaran dulu." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="num text-[13px] font-extrabold text-ink">{item.code}</span>
            <Badge tone="warn">menunggu bayar</Badge>
          </span>
          <span className="text-[11px] text-ink-mute">
            {METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}
            {item.expiresAt ? ` · berlaku hingga ${formatDateTime(item.expiresAt)}` : ""}
          </span>
        </div>
        <span className="num text-[15px] font-extrabold text-astra-ink">
          {formatIDR(item.amount + item.fee)}
        </span>
      </div>

      {message ? (
        <Notice
          tone={message.ok ? "astra" : "danger"}
          icon={message.ok ? <IconCheckCircle size={15} /> : <IconAlert size={15} />}
        >
          {message.text}
        </Notice>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {item.checkoutUrl ? (
          <Button
            size="sm"
            onClick={() => window.location.assign(item.checkoutUrl as string)}
            trailingIcon={<IconArrowRight size={14} />}
          >
            Lanjutkan bayar
          </Button>
        ) : null}
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={checkStatus}
          leadingIcon={<IconRefresh size={14} />}
        >
          {isPending ? "Mengecek…" : "Cek status"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Dompet khusus buyer: saldo untuk belanja, top-up, tagihan yang belum
 * dibayar, dan riwayat transaksi. Tanpa jejak penarikan sama sekali.
 */
export function BuyerWalletView({
  balanceAvailable,
  stats,
  pendingTopUps,
  entries,
  methodFees,
}: {
  balanceAvailable: number;
  stats: BuyerWalletStats;
  pendingTopUps: BuyerPendingTopUp[];
  entries: WalletEntryView[];
  methodFees: Record<"qris" | "va" | "ewallet", number>;
}) {
  const [filter, setFilter] = useState<"semua" | "masuk" | "belanja">("semua");

  const entriesFiltered = entries.filter((entry) => {
    if (filter === "masuk") return entry.amount > 0;
    if (filter === "belanja") return entry.type === "purchase";
    return true;
  });

  return (
    <div className="mx-auto max-w-[1180px] px-4 pb-24 pt-12 md:px-8 md:pt-16">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="flex items-center gap-2 text-[13px] text-ink-mute">
            <IconWallet size={16} className="text-astra-ink" />
            Saldo akun
          </span>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-[2.3rem]">
            Dompet saya
          </h1>
          <p className="max-w-[66ch] text-[13px] leading-relaxed text-ink-dim">
            Isi ulang sekali, pakai berkali-kali. Saldo terpotong otomatis saat checkout dengan
            metode Saldo Akun — tanpa biaya tambahan dan tanpa menunggu.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.4fr_1fr]">
          <div className="bezel-shell bg-astra/[0.03] p-1.5">
            <div className="bezel-core flex flex-col gap-4 p-5 md:p-6">
              <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                Saldo tersedia
              </span>
              <span className="num text-[2rem] font-extrabold leading-none text-astra-ink md:text-[2.5rem]">
                {formatIDR(balanceAvailable)}
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <ButtonLink
                  href="#topup"
                  size="sm"
                  leadingIcon={<IconHexCoin size={14} />}
                >
                  Top-up saldo
                </ButtonLink>
                <ButtonLink
                  href="/katalog"
                  variant="secondary"
                  size="sm"
                  trailingIcon={<IconArrowRight size={14} />}
                >
                  Belanja sekarang
                </ButtonLink>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-1">
            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-astra/10 text-astra-ink">
                  <IconTrendUp size={16} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    Total top-up
                  </span>
                  <span className="num truncate text-[15px] font-extrabold text-ink">
                    {formatIDR(stats.totalTopUp)}
                  </span>
                </span>
              </div>
            </div>
            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-astra/10 text-astra-ink">
                  <IconReceipt size={16} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    Total belanja
                  </span>
                  <span className="num truncate text-[15px] font-extrabold text-ink">
                    {formatIDR(stats.totalSpent)}
                  </span>
                </span>
              </div>
            </div>
            <div className="bezel-shell p-1.5">
              <div className="bezel-core flex items-center gap-3 p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-robux/15 text-[#8a5a00]">
                  <IconCheckCircle size={16} />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                    Total refund
                  </span>
                  <span className="num truncate text-[15px] font-extrabold text-ink">
                    {formatIDR(stats.totalRefund)}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {pendingTopUps.length > 0 ? (
          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-4 p-5">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconClock size={16} className="text-astra-ink" />
                Menunggu pembayaran ({pendingTopUps.length})
              </span>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {pendingTopUps.map((item) => (
                  <PendingTopUpRow key={item.code} item={item} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div id="topup" className="bezel-shell scroll-mt-28 p-1.5">
          <div className="bezel-core p-5">
            <TopUpPanel balanceAvailable={balanceAvailable} methodFees={methodFees} />
          </div>
        </div>

        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
                <IconReceipt size={16} className="text-astra-ink" />
                Riwayat transaksi
              </span>
              <div className="flex gap-1.5 rounded-full bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line">
                {(
                  [
                    { id: "semua", label: "Semua" },
                    { id: "masuk", label: "Masuk" },
                    { id: "belanja", label: "Belanja" },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    className={cx(
                      "relative isolate rounded-full px-3 py-1.5 text-[11px] transition-colors duration-300",
                      filter === option.id ? "text-white" : "text-ink-dim hover:text-ink",
                    )}
                  >
                    {filter === option.id ? (
                      <motion.span
                        layoutId="buyer-wallet-filter"
                        transition={{ type: "spring", stiffness: 320, damping: 30 }}
                        className="absolute inset-0 -z-10 rounded-full bg-astra"
                      />
                    ) : null}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {entriesFiltered.length === 0 ? (
              <EmptyState
                icon={<IconReceipt size={22} />}
                title="Belum ada transaksi di sini"
                description="Top-up saldo dulu, lalu belanja Robux atau item favoritmu — semua tercatat di sini."
              />
            ) : (
              <div className="flex flex-col divide-y divide-hairline">
                {entriesFiltered.map((entry) => {
                  const meta = TYPE_META[entry.type] ?? {
                    label: entry.type,
                    tone: "info" as const,
                  };
                  const positive = entry.amount > 0;
                  const orderLink =
                    entry.orderCode && entry.orderCode.startsWith("BX-")
                      ? `/pesanan/${entry.orderCode}`
                      : null;
                  return (
                    <div key={entry.id} className="flex items-start gap-4 py-4 first:pt-0">
                      <span
                        className={cx(
                          "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl",
                          positive ? "bg-astra/10 text-astra-ink" : "bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line",
                        )}
                      >
                        {positive ? <IconHexCoin size={15} /> : <IconReceipt size={15} />}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[12px] font-bold text-ink">{meta.label}</span>
                          <Badge tone={meta.tone}>
                            {entry.amount > 0 ? "masuk" : "keluar"}
                          </Badge>
                        </div>
                        <span className="text-[11px] leading-relaxed text-ink-mute">
                          {entry.note}
                        </span>
                        <span className="num flex flex-wrap items-center gap-x-2 text-[10px] text-ink-mute">
                          {orderLink ? (
                            <Link
                              href={orderLink}
                              className="font-bold text-astra-ink underline decoration-dotted underline-offset-4 hover:text-astra-bright"
                            >
                              {entry.orderCode}
                            </Link>
                          ) : entry.orderCode ? (
                            <span>{entry.orderCode}</span>
                          ) : null}
                          <span>{formatDateTime(entry.createdAt)}</span>
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span
                          className={cx(
                            "num text-[13px] font-extrabold",
                            positive ? "text-astra-ink" : "text-ink",
                          )}
                        >
                          {positive ? "+" : "−"}
                          {formatIDR(Math.abs(entry.amount))}
                        </span>
                        <span className="num text-[10px] text-ink-mute">
                          saldo {formatIDR(entry.balanceAfter)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Notice tone="info" icon={<IconInfo size={15} />}>
              Refund dari pesanan yang dibatalkan masuk otomatis ke saldo ini dan langsung bisa
              dipakai belanja lagi.
            </Notice>
          </div>
        </div>
      </div>
    </div>
  );
}
