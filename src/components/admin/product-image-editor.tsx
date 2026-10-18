"use client";

import { useRef, useState } from "react";
import { setProductImageAdmin } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { IconUpload, IconX } from "@/components/ui/icons";

const ACCEPT = "image/png,image/jpeg,image/gif,image/webp";
const MAX_BYTES = 1_500_000;

/**
 * Admin photo editor for one listing: paste an https URL or upload a file.
 *
 * Both paths end in the same server action. The URL is validated server-side
 * (https, no credentials, no private hosts) because an admin-pasted string
 * renders as `<img src>` on public pages; the data URL is size- and
 * magic-byte-checked there too. The preview uses the draft value so the admin
 * sees exactly what will be saved before committing.
 */
export function ProductImageEditor({
  productId,
  title,
  imageUrl,
  onSaved,
}: {
  productId: string;
  title: string;
  imageUrl: string | null;
  onSaved: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(imageUrl);
  const [urlText, setUrlText] = useState(
    imageUrl && !imageUrl.startsWith("data:") ? imageUrl : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);

  const dirty = draft !== imageUrl;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`"${file.name}" melebihi ${Math.round(MAX_BYTES / 1000)}KB. Kompres dulu.`);
      return;
    }
    setReading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("read"));
        reader.readAsDataURL(file);
      });
      setDraft(dataUrl);
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
    setDraft(raw);
  }

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    const result = await setProductImageAdmin({ productId, image: next });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDraft(next);
    if (next === null || next.startsWith("data:")) setUrlText("");
    onSaved(next);
  }

  return (
    <div className="flex flex-col gap-3 rounded-well bg-canvas-2 p-3.5">
      <div className="flex flex-wrap items-start gap-3.5">
        <span className="relative block size-24 shrink-0">
          {draft ? (
            // eslint-disable-next-line @next/next/no-img-element -- may be a data URL or an admin-pasted remote URL.
            <img
              src={draft}
              alt={`Foto ${title}`}
              className="size-full rounded-well object-cover outline outline-1 -outline-offset-1 outline-line-strong"
            />
          ) : (
            <span className="grid size-full place-items-center rounded-well bg-canvas text-[10px] text-ink-mute outline outline-1 -outline-offset-1 outline-line">
              Tanpa foto
            </span>
          )}
          {draft ? (
            <button
              type="button"
              aria-label="Hapus foto"
              disabled={busy}
              onClick={() => void save(null)}
              className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-danger text-on-bright shadow disabled:opacity-50"
            >
              <IconX size={12} />
            </button>
          ) : null}
        </span>

        <div className="flex min-w-[220px] flex-1 flex-col gap-2.5">
          <Field label="URL foto (https)" htmlFor={`img-url-${productId}`}>
            <TextInput
              id={`img-url-${productId}`}
              value={urlText}
              placeholder="https://contoh.com/foto.jpg"
              inputMode="url"
              onChange={(event) => setUrlText(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" disabled={busy} onClick={applyUrl}>
              Pakai URL ini
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<IconUpload size={14} />}
              disabled={busy || reading}
              onClick={() => inputRef.current?.click()}
            >
              {reading ? "Membaca..." : "Unggah berkas"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              aria-label="Pilih foto produk"
              onChange={(event) => void pick(event.target.files?.[0] ?? undefined)}
            />
          </div>
        </div>
      </div>

      {error ? <p className="text-[11px] font-bold text-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          size="sm"
          disabled={busy || !dirty}
          onClick={() => void save(draft)}
        >
          {busy ? "Menyimpan..." : "Simpan foto"}
        </Button>
        {dirty ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setDraft(imageUrl);
              setUrlText(imageUrl && !imageUrl.startsWith("data:") ? imageUrl : "");
              setError(null);
            }}
          >
            Batalkan perubahan
          </Button>
        ) : (
          <span className="text-[11px] text-ink-mute">Belum ada perubahan.</span>
        )}
      </div>
    </div>
  );
}