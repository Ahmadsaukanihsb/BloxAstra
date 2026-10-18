"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyAsSeller } from "@/app/actions/seller";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { IconAlert, IconCheck, IconStorefront, IconUpload } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

function readAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Buyer → seller self-service. Collapsed to one line by default; the KYC step
 * (store name, real name, KTP, selfie) only appears once the buyer opts in.
 * Mirrors the seller registration form so approvals look the same in the queue.
 */
export function SellerApplication({ canApply }: { canApply: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [storeName, setStoreName] = useState("");
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
    if (storeName.trim().length < 3) {
      setError("Isi nama toko minimal 3 karakter.");
      return;
    }
    if (fullName.trim().length < 3) {
      setError("Isi nama lengkap sesuai KTP.");
      return;
    }
    if (!idCard || !selfie) {
      setError("Unggah foto KTP dan selfie + KTP.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await applyAsSeller({
        storeName,
        fullName,
        idCardImage: idCard,
        selfieImage: selfie,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  if (!canApply) return null;

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-ink">
              <IconStorefront size={15} className="text-astra-ink" />
              Mulai jualan di Blox Astra
            </span>
            <span className="max-w-[62ch] text-[12px] leading-relaxed text-ink-dim">
              Jual Robux, gamepass, item, atau akun. Pengajuanmu menunggu verifikasi identitas
              admin sebelum toko bisa tayang — saldo escrow dan perlindungan dana berjalan sama
              seperti penjual lain.
            </span>
          </div>
          {!open ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Ajukan jadi penjual
            </Button>
          ) : null}
        </div>

        {open ? (
          <div className="flex flex-col gap-4 border-t border-line pt-4">
            {error ? (
              <Notice tone="danger" icon={<IconAlert size={15} />}>
                {error}
              </Notice>
            ) : null}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nama toko" htmlFor="apply-store">
                <TextInput
                  id="apply-store"
                  value={storeName}
                  onChange={(event) => setStoreName(event.target.value)}
                  placeholder="Mis. Astra Robux Store"
                  maxLength={60}
                />
              </Field>
              <Field label="Nama lengkap sesuai KTP" htmlFor="apply-name">
                <TextInput
                  id="apply-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nama di KTP"
                  maxLength={100}
                />
              </Field>
            </div>

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
                    // eslint-disable-next-line @next/next/no-img-element -- local data-URL preview.
                    <img
                      src={item.value}
                      alt={item.label}
                      className="size-12 shrink-0 rounded-control object-cover"
                    />
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
                  {item.value ? (
                    <IconCheck size={15} className="ml-auto shrink-0 text-astra-ink" />
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="sm" disabled={isPending} onClick={submit}>
                {isPending ? "Mengirim..." : "Kirim pengajuan"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Batal
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}