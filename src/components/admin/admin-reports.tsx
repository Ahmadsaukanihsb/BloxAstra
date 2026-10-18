"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteChatMessageAdmin, dismissChatReport } from "@/app/actions/admin";
import type { ChatReportRow } from "@/lib/admin";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/format";
import { IconAlert, IconCheck, IconFlag, IconTrash } from "@/components/ui/icons";

const REASON_LABEL: Record<string, string> = {
  spam: "Spam",
  kasar: "Kata kasar",
  pribadi: "Data pribadi",
};

/** Seller-chat reports: delete the message (soft) or dismiss the report. */
export function ReportsPanel({ initial }: { initial: ChatReportRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One report row disappears per action; sibling reports on the same
  // message vanish too when the message is deleted server-side.
  function dropReport(id: string) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function dropMessage(messageId: string) {
    setRows((prev) => prev.filter((row) => row.messageId !== messageId));
  }

  async function handleDismiss(row: ChatReportRow) {
    const result = await dismissChatReport(row.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dropReport(row.id);
    setFlash("Laporan diabaikan. Pesan dibiarkan.");
    router.refresh();
  }

  async function handleDelete(row: ChatReportRow) {
    if (!window.confirm(`Hapus pesan dari ${row.authorName}?`)) return;
    const result = await deleteChatMessageAdmin(row.messageId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    dropMessage(row.messageId);
    setFlash("Pesan dihapus (soft delete). Semua laporannya ikut bersih.");
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconFlag size={22} />}
        title="Tidak ada laporan"
        description="Pesan grup seller yang dilaporkan penjual lain muncul di sini untuk ditindak."
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
        <RecordFrame key={row.id} tone={row.messageDeleted ? "neutral" : "warn"}>
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge tone="warn" icon={<IconFlag size={13} />}>
              {REASON_LABEL[row.reason] ?? row.reason}
            </Badge>
            {row.messageDeleted ? <Badge tone="muted">Pesan sudah dihapus</Badge> : null}
            <span className="num ml-auto text-[11px] text-ink-mute">{formatDateTime(row.createdAt)}</span>
          </div>
          <p className="rounded-well bg-canvas-2 p-4 text-[13px] leading-relaxed text-ink-dim">
            “{row.messageBody}”
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[12px] text-ink-mute">
              {row.authorName} · dilaporkan {row.reporterName}
            </span>
            <span className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleDismiss(row)}>
                Abaikan
              </Button>
              {!row.messageDeleted ? (
                <Button
                  variant="danger"
                  size="sm"
                  leadingIcon={<IconTrash size={15} />}
                  onClick={() => void handleDelete(row)}
                >
                  Hapus pesan
                </Button>
              ) : null}
            </span>
          </div>
        </RecordFrame>
      ))}
    </div>
  );
}
