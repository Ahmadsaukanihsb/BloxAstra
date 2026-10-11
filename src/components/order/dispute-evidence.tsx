"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyDispute } from "@/app/actions/room";
import type { OrderDisputeInfo } from "@/lib/orders";
import { cx } from "@/lib/cx";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheck, IconUpload, IconX } from "@/components/ui/icons";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_FILES = 3;
const MAX_BYTES = 1_500_000;

/** Read-only thumbnails for stored dispute evidence (data URLs). */
export function EvidenceGallery({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((src, index) => (
        <a
          key={`${index}-${src.slice(0, 32)}`}
          href={src}
          target="_blank"
          rel="noreferrer"
          title={`Bukti ${index + 1}, klik untuk ukuran penuh`}
          className="block size-20 shrink-0 overflow-hidden rounded-control outline outline-1 -outline-offset-1 outline-line transition-transform duration-200 hover:scale-[1.04]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Bukti sengketa ${index + 1}`} className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

/** File picker used inside the dispute form — returns data URLs to the parent. */
export function EvidencePicker({
  items,
  onChange,
}: {
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function pick(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const slots = MAX_FILES - items.length;
    if (slots <= 0) {
      setError(`Maksimal ${MAX_FILES} gambar.`);
      return;
    }
    const chosen = [...files].slice(0, slots);
    for (const file of chosen) {
      if (!file.type.startsWith("image/")) {
        setError(`"${file.name}" bukan gambar.`);
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`"${file.name}" melebihi 1,5MB.`);
        return;
      }
    }
    setReading(true);
    try {
      const urls = await Promise.all(chosen.map(readAsDataUrl));
      onChange([...items, ...urls].slice(0, MAX_FILES));
    } catch {
      setError("Gagal membaca file. Coba lagi.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => void pick(event.target.files)}
      />
      <button
        type="button"
        disabled={reading || items.length >= MAX_FILES}
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2.5 rounded-well bg-canvas p-4 text-left text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:bg-canvas disabled:opacity-50"
      >
        <IconUpload size={16} className={items.length > 0 ? "text-astra-ink" : "text-ink-mute"} />
        {reading
          ? "Membaca gambar…"
          : items.length > 0
            ? `${items.length}/${MAX_FILES} gambar dilampirkan, klik untuk tambah`
            : "Lampirkan bukti (maks 3 gambar @1,5MB): screenshot, surat Roblox, dll.)"}
      </button>
      {error ? (
        <p className="text-xs font-bold text-danger">{error}</p>
      ) : null}
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2.5">
          {items.map((src, index) => (
            <span key={`${index}-${src.slice(0, 32)}`} className="relative block size-20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`Lampiran ${index + 1}`}
                className="size-full rounded-control object-cover outline outline-1 -outline-offset-1 outline-line"
              />
              <button
                type="button"
                aria-label={`Hapus lampiran ${index + 1}`}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-danger text-white shadow"
              >
                <IconX size={12} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Full dispute thread: reason, buyer note + evidence, seller reply (or reply form). */
export function DisputeThread({
  orderCode,
  dispute,
  viewerRole,
}: {
  orderCode: string;
  dispute: NonNullable<OrderDisputeInfo>;
  viewerRole: "buyer" | "seller" | "admin";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reply, setReply] = useState(dispute.sellerReply);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isSeller = viewerRole === "seller";
  const locked = dispute.status !== "open" && dispute.status !== "under_review";

  function submitReply() {
    const text = reply.trim();
    if (text.length < 12) {
      setError("Balasan minimal 12 karakter. Jelaskan versimu dengan bukti.");
      return;
    }
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await replyDispute({ orderCode, sellerReply: text });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-well bg-danger/[0.04] p-5 outline outline-1 -outline-offset-1 outline-danger/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-ink">Sengketa #{dispute.ref} dibuka</span>
        <span className="num rounded-full bg-danger/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-danger">
          {dispute.status === "open" ? "menunggu balasan" : dispute.status.replace("_", " ")}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="eyebrow text-ink-mute">
          Klaim pembeli · {dispute.reasonLabel}
        </span>
        <p className="text-[12px] leading-relaxed text-ink-dim">{dispute.buyerNote}</p>
        <EvidenceGallery items={dispute.evidence} />
      </div>

      <div className="flex flex-col gap-2 border-t border-danger/15 pt-4">
        <span className="eyebrow text-ink-mute">
          Balasan penjual
        </span>
        {isSeller && !locked ? (
          <div className="flex flex-col gap-2.5">
            <Field label="Tanggapanmu" htmlFor="seller-reply" hint="Minimal 12 karakter. Admin membaca ini sebelum memutus.">
              <TextArea
                id="seller-reply"
                value={reply}
                onChange={(event) => {
                  setReply(event.target.value);
                  setSaved(false);
                }}
                placeholder="Jelaskan versimu: kapan dikirim, bukti pengiriman, atau alasan keterlambatan…"
              />
            </Field>
            {error ? (
              <Notice tone="danger" icon={<IconAlert size={15} />}>
                {error}
              </Notice>
            ) : null}
            {saved ? (
              <Notice tone="astra" icon={<IconCheck size={15} />}>
                Balasan terkirim. Admin dan pembeli bisa melihatnya.
              </Notice>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              disabled={isPending || reply.trim().length < 12}
              onClick={submitReply}
            >
              {isPending ? "Mengirim…" : dispute.sellerReply ? "Perbarui balasan" : "Kirim balasan"}
            </Button>
          </div>
        ) : dispute.sellerReply ? (
          <p className="text-[12px] leading-relaxed text-ink-dim">“{dispute.sellerReply}”</p>
        ) : (
          <p className="text-[12px] italic text-ink-mute">
            Penjual belum membalas. {locked ? "Sengketa sudah diputus." : "Menunggu tanggapan penjual."}
          </p>
        )}
      </div>

      <p className={cx("text-[11px] text-ink-mute")}>
        Dana dibekukan, auto-release dihentikan. Tim mediasi menjawab maksimal 1×24 jam.
      </p>
    </div>
  );
}
