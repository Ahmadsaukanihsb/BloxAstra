"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { IconCheck, IconUpload, IconX } from "@/components/ui/icons";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/** Single-image picker returning a data URL (or null). 1.5MB cap, preview built in. */
export function ImagePicker({
  value,
  onChange,
  label,
  hint = "PNG/JPG/GIF/WebP, maksimal 1,5MB. Kosongkan untuk pakai gambar otomatis.",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > 1_500_000) {
      setError(`"${file.name}" melebihi 1,5MB. Kompres dulu.`);
      return;
    }
    setReading(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      onChange(url);
    } catch {
      setError("Gagal membaca file. Coba lagi.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-ink-mute">
        {label}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label={label}
        onChange={(event) => void pick(event.target.files?.[0] ?? undefined)}
      />
      <div className="flex items-center gap-3">
        {value ? (
          <span className="relative block size-20 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="Pratinjau foto produk"
              className="size-full rounded-well object-cover outline outline-1 -outline-offset-1 outline-line-strong"
            />
            <button
              type="button"
              aria-label="Hapus foto"
              onClick={() => onChange(null)}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-danger text-white shadow"
            >
              <IconX size={12} />
            </button>
          </span>
        ) : null}
        <button
          type="button"
          disabled={reading}
          onClick={() => inputRef.current?.click()}
          className={cx(
            "flex flex-1 items-center gap-2.5 rounded-well border border-dashed p-4 text-left transition-colors duration-200",
            value
              ? "border-astra/40 bg-astra/[0.06]"
              : "border-line-strong bg-canvas hover:bg-canvas",
            reading && "opacity-60",
          )}
        >
          {value ? (
            <IconCheck size={16} className="shrink-0 text-astra-ink" />
          ) : (
            <IconUpload size={16} className="shrink-0 text-ink-mute" />
          )}
          <span className="flex flex-col gap-0.5">
            <span className="text-[12px] font-bold text-ink">
              {reading ? "Membaca…" : value ? "Foto terpasang, klik untuk ganti" : "Pilih foto produk"}
            </span>
            <span className="text-[11px] text-ink-mute">{hint}</span>
          </span>
        </button>
      </div>
      {error ? <p className="text-xs font-bold text-danger">{error}</p> : null}
    </div>
  );
}
