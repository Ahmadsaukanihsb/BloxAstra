"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubmitKyc } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheck, IconUpload } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/** Rejected sellers upload fresh KYC documents and re-enter the queue. */
export function KycResubmitForm({ rejectReason }: { rejectReason: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [idCard, setIdCard] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);

  async function pick(file: File | undefined, set: (url: string | null) => void) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError(`"${file.name}" bukan gambar.`);
      return;
    }
    if (file.size > 1_000_000) {
      setError(`"${file.name}" melebihi 1MB. Kompres dulu.`);
      return;
    }
    const url = await readAsDataUrl(file);
    if (!url) {
      setError("Gagal membaca file. Coba lagi.");
      return;
    }
    set(url);
  }

  function submit() {
    if (fullName.trim().length < 3) {
      setError("Isi nama lengkap sesuai KTP.");
      return;
    }
    if (!idCard || !selfie) {
      setError("Unggah ulang foto KTP dan selfie.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await resubmitKyc({ fullName, idCardImage: idCard, selfieImage: selfie });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-well bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-bold text-ink">Ajukan ulang verifikasi</span>
        {rejectReason ? (
          <span className="text-[12px] leading-relaxed text-ink-dim">
            Alasan penolakan admin: <span className="font-bold text-danger">{rejectReason}</span>
          </span>
        ) : null}
      </div>

      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />}>
          {error}
        </Notice>
      ) : null}

      <Field label="Nama lengkap sesuai KTP" htmlFor="resubmit-name">
        <TextInput
          id="resubmit-name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Nama di KTP"
          maxLength={100}
        />
      </Field>

      <input
        ref={idRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0], setIdCard);
          event.target.value = "";
        }}
      />
      <input
        ref={selfieRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          void pick(event.target.files?.[0], setSelfie);
          event.target.value = "";
        }}
      />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[
          { label: "Foto KTP", value: idCard, ref: idRef },
          { label: "Selfie + KTP", value: selfie, ref: selfieRef },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => item.ref.current?.click()}
            className={cx(
              "flex items-center gap-2.5 rounded-well border border-dashed p-3.5 text-left transition-colors duration-200",
              item.value ? "border-astra/40 bg-astra/[0.06]" : "border-line-strong hover:bg-canvas",
            )}
          >
            {item.value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.value} alt={item.label} className="size-12 shrink-0 rounded-control object-cover" />
            ) : (
              <span className="grid size-12 shrink-0 place-items-center rounded-control bg-canvas text-ink-dim">
                <IconUpload size={16} />
              </span>
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[12px] font-bold text-ink">{item.label}</span>
              <span className="text-[10px] text-ink-mute">
                {item.value ? "terlampir, klik untuk ganti" : "maks 1MB"}
              </span>
            </span>
            {item.value ? <IconCheck size={15} className="ml-auto shrink-0 text-astra-ink" /> : null}
          </button>
        ))}
      </div>

      <Button size="sm" className="w-fit" disabled={isPending} onClick={submit}>
        {isPending ? "Mengirim…" : "Kirim ulang pengajuan"}
      </Button>
    </div>
  );
}
