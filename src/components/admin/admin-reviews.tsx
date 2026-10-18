"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { hideReview, unhideReview } from "@/app/actions/admin";
import type { AdminReviewRow } from "@/lib/admin";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { IconAlert, IconCheck, IconEye, IconEyeOff } from "@/components/ui/icons";

/**
 * Review moderation: hide abusive or fake-looking buyer comments from every
 * public surface (homepage strip, product page, rating aggregate), or
 * restore them. Hiding is reversible — rows are never deleted.
 */
export function ReviewsPanel({ initial }: { initial: AdminReviewRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(row: AdminReviewRow) {
    setPending(row.id);
    setError(null);
    const result = row.hidden ? await unhideReview(row.id) : await hideReview(row.id);
    setPending(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, hidden: !item.hidden } : item)));
    setFlash(row.hidden ? "Ulasan ditampilkan kembali." : "Ulasan disembunyikan dari publik.");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconEye size={22} />}
        title="Belum ada ulasan"
        description="Ulasan yang ditulis pembeli di pesanan selesai muncul di sini untuk dimoderasi."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}
      {rows.map((row) => (
        <RecordFrame key={row.id} tone={row.hidden ? "warn" : "neutral"}>
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className="text-[13px] font-extrabold tracking-[0.12em] text-gold"
              aria-label={`${row.rating} dari 5 bintang`}
            >
              {"★".repeat(row.rating)}
              <span className="text-ink-mute">{"★".repeat(Math.max(0, 5 - row.rating))}</span>
            </span>
            {row.hidden ? (
              <Badge tone="warn" icon={<IconEyeOff size={13} />}>
                Disembunyikan
              </Badge>
            ) : null}
            <span className="num ml-auto text-[11px] text-ink-mute">{formatDateTime(row.createdAt)}</span>
          </div>
          <p className="rounded-well bg-canvas-2 p-4 text-[13px] leading-relaxed text-ink-dim">
            {row.comment || "(tanpa komentar)"}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-ink-mute">
              {row.buyerName}
              {row.productTitle ? ` → ${row.productTitle}` : ""}
              {row.sellerStoreName ? ` · ${row.sellerStoreName}` : ""}
              {" · "}
              <ButtonLink href={`/pesanan/${row.orderCode}`} variant="ghost" size="sm" className="inline-flex">
                {row.orderCode}
              </ButtonLink>
            </span>
            <Button
              variant={row.hidden ? "secondary" : "ghost"}
              size="sm"
              leadingIcon={row.hidden ? <IconEye size={15} /> : <IconEyeOff size={15} />}
              disabled={pending !== null}
              onClick={() => void toggle(row)}
            >
              {pending === row.id ? "…" : row.hidden ? "Tampilkan" : "Sembunyikan"}
            </Button>
          </div>
        </RecordFrame>
      ))}
    </div>
  );
}
