"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { creditTopUpManual } from "@/app/actions/admin";
import type { AdminTopUpRow } from "@/lib/admin";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDateTime, formatIDR } from "@/lib/format";
import { IconAlert, IconCheck, IconWallet } from "@/components/ui/icons";

const STATUS_TONE: Record<string, "warn" | "danger" | "neutral"> = {
  pending: "warn",
  failed: "danger",
  expired: "neutral",
};

/**
 * Top-ups that never got credited — the manual-credit queue. Credits only
 * after the admin verified the money off-band; every credit is audited.
 */
export function TopUpsPanel({ initial }: { initial: AdminTopUpRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function handleCredit(row: AdminTopUpRow) {
    if (!window.confirm(`Kreditkan ${formatIDR(row.amount)} ke ${row.username} (${row.code})? Pastikan dana sudah masuk.`)) {
      return;
    }
    setPending(row.code);
    setError(null);
    const result = await creditTopUpManual(row.code);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((prev) => prev.filter((item) => item.code !== row.code));
    setFlash(`${row.code} dikreditkan ke ${row.username}.`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconWallet size={22} />}
        title="Tidak ada top-up menggantung"
        description="Top-up pending, gagal, atau kedaluwarsa yang belum dikreditkan muncul di sini."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat di admin_audit_logs">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}
      {rows.map((row) => (
        <RecordFrame key={row.code} tone={row.status === "pending" ? "warn" : "neutral"}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="num text-[13px] font-extrabold text-ink">{row.code}</span>
            <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Badge>
            <span className="price text-[15px] leading-none text-ink">{formatIDR(row.amount)}</span>
            <span className="text-[11px] text-ink-mute">
              +{formatIDR(row.fee)} fee · {row.paymentMethod}
            </span>
            <span className="num ml-auto text-[11px] text-ink-mute">{formatDateTime(row.createdAt)}</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-ink-dim">
              {row.username}
              {row.expiresAt ? <span className="text-ink-mute"> · kedaluwarsa {formatDateTime(row.expiresAt)}</span> : null}
            </span>
            <Button
              size="sm"
              leadingIcon={<IconCheck size={15} />}
              disabled={pending !== null}
              onClick={() => void handleCredit(row)}
            >
              {pending === row.code ? "Memproses…" : "Kreditkan manual"}
            </Button>
          </div>
        </RecordFrame>
      ))}
      <Notice tone="info" icon={<IconAlert size={15} />} title="Kapan tombol ini dipakai">
        Hanya setelah dana diverifikasi di luar sistem (mutasi bank / dasbor gateway). Kredit manual
        menulis ledger dan tercatat di log audit atas nama admin yang menekan.
      </Notice>
    </div>
  );
}
