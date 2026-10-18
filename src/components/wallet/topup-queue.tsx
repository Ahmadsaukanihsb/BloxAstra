"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatIDR, formatDateTime } from "@/lib/format";
import { reconcileTopUp } from "@/app/actions/topup";
import type { OpenTopUp } from "@/lib/topup";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconClock,
  IconRefresh,
} from "@/components/ui/icons";

const METHOD_LABEL: Record<string, string> = {
  qris: "QRIS",
  va: "Virtual Account",
  ewallet: "E-Wallet",
};

/**
 * `pending` still wants the buyer's money; `failed` and `expired` are the
 * rows that may already have been paid at the gateway without ever reaching
 * the wallet — they must stay reachable instead of vanishing from the page.
 */
const STATUS_META: Record<
  OpenTopUp["status"],
  { label: string; tone: "warn" | "danger" | "neutral"; hint: string }
> = {
  pending: {
    label: "menunggu bayar",
    tone: "warn",
    hint: "Selesaikan pembayaran sebelum jendela 15 menit habis.",
  },
  failed: {
    label: "perlu dicek",
    tone: "danger",
    hint: "Kalau kamu sudah membayar, tekan Cek status — gateway yang memutuskan.",
  },
  expired: {
    label: "kedaluwarsa",
    tone: "neutral",
    hint: "Jendela bayar habis. Kalau dana sudah terlanjur masuk, tekan Cek status.",
  },
};

function TopUpQueueRow({ item }: { item: OpenTopUp }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const meta = STATUS_META[item.status];

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
    <div className="flex flex-col gap-3 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="num text-[13px] font-extrabold text-ink">{item.code}</span>
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </span>
          <span className="text-[11px] text-ink-mute">
            {METHOD_LABEL[item.paymentMethod] ?? item.paymentMethod}
            {item.expiresAt ? ` · berlaku hingga ${formatDateTime(item.expiresAt)}` : ""}
          </span>
          <span className={cx("text-[11px] leading-relaxed", item.status === "pending" ? "text-ink-mute" : "text-ink-dim")}>
            {meta.hint}
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
        {item.checkoutUrl && item.status === "pending" ? (
          <Button
            size="sm"
            onClick={() => window.location.assign(item.checkoutUrl as string)}
            trailingIcon={<IconArrowRight size={14} />}
          >
            Lanjutkan bayar
          </Button>
        ) : null}
        <Button
          variant={item.checkoutUrl && item.status === "pending" ? "secondary" : "primary"}
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
 * Invoices that still need attention: unpaid, or paid at the gateway but not
 * credited yet. Rendered on both the buyer and the seller wallet so nobody's
 * money can go missing behind a status they cannot see.
 */
export function TopUpQueue({ items }: { items: OpenTopUp[] }) {
  if (items.length === 0) return null;
  const unpaid = items.filter((item) => item.status !== "pending").length;

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2.5 text-[13px] font-bold text-ink">
            <IconClock size={16} className="text-astra-ink" />
            Top-up perlu ditindak ({items.length})
          </span>
          {unpaid > 0 ? (
            <span className="text-[11px] text-ink-mute">
              Sudah bayar tapi saldo belum masuk? Tekan Cek status.
            </span>
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <TopUpQueueRow key={item.code} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
