"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { approveKyc, rejectKyc } from "@/app/actions/admin";
import { formatDateTime } from "@/lib/format";
import { RecordFrame } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { Field, TextInput } from "@/components/ui/field";
import { EvidenceGallery } from "@/components/order/dispute-evidence";
import {
  IconAlert,
  IconCheck,
  IconShieldCheck,
  IconStorefront,
} from "@/components/ui/icons";

export interface KycQueueRow {
  userId: string;
  username: string;
  email: string;
  whatsapp: string | null;
  joinedAt: string;
  storeName: string | null;
  tier: number | null;
  fullName: string | null;
  idCardImage: string | null;
  selfieImage: string | null;
}

export function KycQueue({ rows: initialRows, total }: { rows: KycQueueRow[]; total: number }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function drop(userId: string) {
    setRows((prev) => prev.filter((row) => row.userId !== userId));
  }

  async function handleApprove(row: KycQueueRow) {
    const result = await approveKyc({ userId: row.userId });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    drop(row.userId);
    setFlash(`KYC ${row.username} disetujui. Toko "${row.storeName ?? row.username}" terverifikasi.`);
    router.refresh();
  }

  async function handleReject(row: KycQueueRow, reason: string) {
    const result = await rejectKyc({ userId: row.userId, reason });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    drop(row.userId);
    setFlash(`KYC ${row.username} ditolak. Pendaftaran toko dikembalikan ke penjual.`);
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<IconShieldCheck size={22} />}
        title="Antrean KYC bersih"
        description="Tidak ada pendaftaran penjual yang menunggu verifikasi. Pengajuan baru dari /daftar (mode penjual) akan muncul di sini."
        action={
          <ButtonLink href="/admin/cari?jenis=pengguna&kyc=pending" variant="secondary" size="sm">
            Riwayat pengajuan
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {total > rows.length ? (
        <Notice
          tone="warn"
          icon={<IconAlert size={15} />}
          title={`Menampilkan ${rows.length} dari ${total} antrean`}
        >
          Proses yang tampil dulu. Sisanya muncul setelah antrean berkurang.
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tercatat di admin_audit_logs">
          {flash}
        </Notice>
      ) : null}

      {rows.map((row) => (
        <KycRow key={row.userId} row={row} onApprove={handleApprove} onReject={handleReject} />
      ))}

      <Notice tone="info" icon={<IconShieldCheck size={15} />} title="Alur KYC">
        Menyetujui menandai akun &amp; toko terverifikasi (user.kycStatus → verified,
        seller_profile.kyc_verified → true). Menolak mencatat alasan di log audit. Keduanya
        dibatasi satu kali: pengajuan yang sudah diproses tidak bisa diproses ulang.
      </Notice>
    </div>
  );
}

function KycRow({
  row,
  onApprove,
  onReject,
}: {
  row: KycQueueRow;
  onApprove: (row: KycQueueRow) => void | Promise<void>;
  onReject: (row: KycQueueRow, reason: string) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const initials = row.username.slice(0, 2).toUpperCase();

  async function handleApprove() {
    setPending(true);
    await onApprove(row);
    setPending(false);
  }

  async function handleReject() {
    const trimmed = reason.trim();
    if (trimmed.length < 3) return;
    setPending(true);
    await onReject(row, trimmed);
    setPending(false);
  }

  return (
    <RecordFrame tone="warn">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="warn" icon={<IconShieldCheck size={13} />}>
          KYC pending
        </Badge>
        <span className="num text-[11px] text-ink-mute">
          Diajukan {formatDateTime(row.joinedAt)}
        </span>
        <span className="num ml-auto text-[11px] text-ink-mute">{row.email}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-astra/15 text-[12px] font-extrabold text-astra-ink">
          {initials}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-bold text-ink">{row.username}</span>
            {row.storeName ? (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-dim">
                <IconStorefront size={13} className="text-ink-mute" />
                {row.storeName}
              </span>
            ) : null}
            {row.tier !== null ? <Badge tone="neutral">Tier {row.tier}</Badge> : null}
          </div>
          <span className="num text-[11px] text-ink-mute">
            {row.whatsapp ? `WhatsApp ${row.whatsapp}` : "Tanpa nomor WhatsApp"}
          </span>
          {row.fullName ? (
            <span className="text-[11px] text-ink-dim">
              KTP a.n. <span className="font-bold text-ink">{row.fullName}</span>
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-well bg-canvas-2 p-4">
        <span className="eyebrow text-ink-mute">Dokumen identitas</span>
        <EvidenceGallery
          items={[row.idCardImage, row.selfieImage].filter((src): src is string => Boolean(src))}
        />
        {[row.idCardImage, row.selfieImage].every(Boolean) ? null : (
          <span className="text-[11px] font-bold text-danger">
            Berkas tidak lengkap. Tolak dan minta unggah ulang.
          </span>
        )}
      </div>

      {mode === "view" ? (
        <div className="flex flex-wrap justify-end gap-2.5 border-t border-line pt-4">
          <Button
            size="sm"
            leadingIcon={<IconCheck size={15} />}
            disabled={pending}
            onClick={() => void handleApprove()}
          >
            {pending ? "Memproses…" : "Setujui KYC"}
          </Button>
          <Button
            variant="danger"
            size="sm"
            leadingIcon={<IconAlert size={15} />}
            disabled={pending}
            onClick={() => setMode("reject")}
          >
            Tolak
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 rounded-well bg-canvas-2 p-4 sm:ml-auto sm:w-auto sm:min-w-[320px]">
          <Field label="Alasan penolakan" htmlFor={`kyc-reject-${row.userId}`}>
            <TextInput
              id={`kyc-reject-${row.userId}`}
              value={reason}
              placeholder="Mis. dokumen identitas tidak terbaca"
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button
              variant="danger"
              size="sm"
              disabled={pending || reason.trim().length < 3}
              onClick={() => void handleReject()}
            >
              {pending ? "Memproses…" : "Konfirmasi tolak"}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setMode("view")}>
              Batal
            </Button>
          </div>
        </div>
      )}
    </RecordFrame>
  );
}
