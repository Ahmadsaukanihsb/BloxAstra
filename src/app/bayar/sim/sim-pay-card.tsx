"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { formatIDR } from "@/lib/format";
import { settleSimPayment } from "@/app/actions/orders";
import { reconcileTopUp } from "@/app/actions/topup";

export interface SimOrderSummary {
  orderCode: string;
  kind: "order" | "topup";
  itemTitle: string;
  total: number;
  status: string;
  paymentStatus: string;
  expiresAt: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Menunggu pembayaran",
  paid: "Lunas",
  processing: "Diproses",
  shipped: "Dikirim",
  completed: "Selesai",
  disputed: "Sengketa",
  refunded: "Dikembalikan",
  cancelled: "Dibatalkan",
};

/** Local stand-in for the Midtrans Snap checkout page (sim mode only). */
export function SimPayCard({ order, simMode }: { order: SimOrderSummary; simMode: boolean }) {
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(order.paymentStatus === "settled");
  const [error, setError] = useState<string | null>(null);

  const settled = paid || order.paymentStatus === "settled";
  const cancelled = order.status === "cancelled";

  async function handlePay() {
    setPaying(true);
    setError(null);
    if (order.kind === "topup") {
      const result = await reconcileTopUp(order.orderCode);
      setPaying(false);
      if (result.ok && result.credited) {
        setPaid(true);
        return;
      }
      setError(result.ok ? "Top-up belum masuk. Coba lagi." : result.error);
      return;
    }
    const result = await settleSimPayment(order.orderCode);
    setPaying(false);
    if (result.ok) {
      setPaid(true);
      return;
    }
    setError(result.error);
  }

  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-line bg-paper p-6 md:p-8">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-[0.18em] text-ink-dim uppercase">
          Simulasi pembayaran
        </p>
        <h1 className="font-display text-2xl font-bold text-ink">{order.orderCode}</h1>
      </div>

      {!simMode ? (
        <Notice tone="warn" title="Mode live aktif">
          PAYMENT_PROVIDER bukan &quot;sim&quot; — halaman ini tidak menerima pembayaran.
        </Notice>
      ) : null}

      <dl className="flex flex-col gap-3 rounded-2xl bg-canvas p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-dim">Item</dt>
          <dd className="text-right font-semibold text-ink">{order.itemTitle}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-dim">Status</dt>
          <dd className="font-semibold text-ink">
            {settled ? "Lunas" : (STATUS_LABEL[order.status] ?? order.status)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-ink-dim">Total tagihan</dt>
          <dd className="font-display text-lg font-bold text-ink">{formatIDR(order.total)}</dd>
        </div>
      </dl>

      {error ? (
        <Notice tone="danger" title="Gagal memproses">
          {error}
        </Notice>
      ) : null}

      {settled ? (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 font-display text-2xl font-bold text-emerald-600">
            ✓
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink">Pembayaran lunas</p>
            <p className="mt-1 text-sm text-ink-dim">
              {order.kind === "topup"
                ? `Saldo ${order.orderCode} masuk ke dompetmu.`
                : `Pesanan ${order.orderCode} sudah diterima platform.`}
            </p>
          </div>
          <ButtonLink href={order.kind === "topup" ? "/dompet" : "/pesanan"} size="lg">
            {order.kind === "topup" ? "Lihat dompet saya" : "Lihat pesanan saya"}
          </ButtonLink>
        </div>
      ) : cancelled ? (
        <Notice tone="danger" title="Pesanan dibatalkan">
          Pembayaran ini tidak dapat dilanjutkan. Buat pesanan baru dari katalog.
        </Notice>
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="lg" fullWidth onClick={handlePay} disabled={paying || !simMode}>
            {paying ? "Memproses…" : `Bayar sekarang — ${formatIDR(order.total)}`}
          </Button>
          <Link
            href="/pesanan"
            className="text-center text-sm font-semibold text-ink-dim hover:text-ink"
          >
            Nanti saja
          </Link>
        </div>
      )}
    </div>
  );
}
