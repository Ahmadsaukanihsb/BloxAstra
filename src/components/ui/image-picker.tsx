"use client";

import { useRef, useState } from "react";
import { cx } from "@/lib/cx";
import { compressImageFile } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { IconCheck, IconUpload, IconX } from "@/components/ui/icons";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Single-image picker returning a data URL or an https URL (or null).
 *
 * Two ways in, one value out: pick a file (read to a data URL) or paste a link.
 * Remote URLs cost this page's payload nothing, so they are neither fetched nor
 * size-capped here; the server validates shape (https, no credentials, no
 * private hosts) before anything is stored or rendered.
 */
export function ImagePicker({
  value,
  onChange,
  label,
  hint = "PNG/JPG/GIF/WebP, maksimal 1,5MB. Kosongkan untuk pakai gambar otomatis.",
  maxBytes = 1_500_000,
  pickTitle = "Pilih foto produk",
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  label: string;
  hint?: string;
  /**
   * Client-side ceiling. Lower it where the image is served on every page load
   * (see `SERVICE_ART_MAX_BYTES`) so a too-large file is refused at the point of
   * choosing rather than after a round trip to the server.
   */
  maxBytes?: number;
  /** CTA text on the dashed pick button (e.g. "Pilih logo toko"). */
  pickTitle?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlText, setUrlText] = useState(value && !value.startsWith("data:") ? value : "");

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    setReading(true);
    try {
      // Oversized files are compressed here rather than refused: the cap exists
      // to protect the page payload, not to make the admin pre-squash a logo.
      // A file that already fits is passed through untouched, so an already
      // transparent PNG is never needlessly re-encoded (which would lose alpha
      // if it fell back to JPEG).
      if (file.size > maxBytes) {
        const shrunk = await compressImageFile(file, maxBytes);
        if (!shrunk) {
          setError(
            `"${file.name}" terlalu besar dan gagal dikompres ke ${Math.round(maxBytes / 1000)}KB. Coba gambar yang lebih sederhana atau resolusinya lebih kecil.`,
          );
          return;
        }
        onChange(shrunk);
        setUrlOpen(false);
        setUrlText("");
        return;
      }
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      onChange(url);
      setUrlOpen(false);
      setUrlText("");
    } catch {
      setError("Gagal membaca file. Coba lagi.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyUrl() {
    const raw = urlText.trim();
    if (!raw) {
      setError("Tempel URL gambar dulu.");
      return;
    }
    if (!raw.startsWith("https://")) {
      setError("URL harus diawali https://");
      return;
    }
    setError(null);
    onChange(raw);
    setUrlOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-ink-mute">{label}</span>
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
              onClick={() => {
                onChange(null);
                setUrlText("");
              }}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-danger text-on-bright shadow"
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
            value ? "border-astra/40 bg-astra/[0.06]" : "border-line-strong bg-canvas hover:bg-canvas",
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
              {reading ? "Membaca..." : value ? "Foto terpasang, klik untuk ganti" : pickTitle}
            </span>
            <span className="text-[11px] text-ink-mute">{hint}</span>
          </span>
        </button>
      </div>

      {/* Link path: paste a hosted image instead of uploading bytes. */}
      {urlOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <TextInput
              value={urlText}
              placeholder="https://contoh.com/gambar.png"
              inputMode="url"
              aria-label={`URL gambar ${label}`}
              onChange={(event) => setUrlText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  applyUrl();
                }
              }}
            />
          </div>
          <Button type="button" size="sm" onClick={applyUrl}>
            Pakai
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUrlOpen(false);
              setError(null);
            }}
          >
            Batal
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setUrlOpen(true);
            setError(null);
          }}
          className="w-fit text-[11px] font-bold text-astra-ink underline decoration-dotted underline-offset-4 transition-colors hover:text-ink"
        >
          Atau tempel URL gambar
        </button>
      )}

      {error ? <p className="text-xs font-bold text-danger">{error}</p> : null}
    </div>
  );
}
