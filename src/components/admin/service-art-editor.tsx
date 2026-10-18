"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveServiceArt } from "@/app/actions/admin";
import {
  SERVICE_ART_MAX_BYTES,
  SERVICE_ART_SLOTS,
  type ServiceArt,
} from "@/lib/service-art-slots";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { ImagePicker } from "@/components/ui/image-picker";
import { IconCheck, IconRefresh, IconSparkle } from "@/components/ui/icons";

/**
 * Artwork editor for the four entry points on the homepage shelf.
 *
 * Only changed slots are sent. The action merges them into what is already
 * stored, so saving one tile never touches the other three — and clearing a
 * slot is sent as `null` rather than omitted, which is how the built-in icon
 * comes back.
 */
export function ServiceArtEditor({ initialArt }: { initialArt: ServiceArt }) {
  const router = useRouter();
  const [art, setArt] = useState<Record<string, string | null>>({ ...initialArt });
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const changed = SERVICE_ART_SLOTS.filter((slot) => {
    const draft = art[slot.key] ?? null;
    const saved = initialArt[slot.key] ?? null;
    return draft !== saved;
  });

  /**
   * Both writes go through here so a thrown action cannot strand the form.
   * Setting `pending` after an `await` that rejects leaves the buttons disabled
   * forever with no message — the state that showed up while building this.
   */
  async function run(
    payload: Record<string, string | null>,
    onSuccess: () => string,
  ): Promise<void> {
    setPending(true);
    setError(null);
    setFlash(null);
    try {
      const result = await saveServiceArt({ art: payload });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setFlash(onSuccess());
      router.refresh();
    } catch {
      setError("Penyimpanan gagal di server. Coba lagi sebentar lagi.");
    } finally {
      setPending(false);
    }
  }

  function save() {
    if (!changed.length) return;
    void run(
      Object.fromEntries(changed.map((slot) => [slot.key, art[slot.key] ?? null])),
      () => `Gambar untuk ${changed.map((slot) => slot.label).join(", ")} tersimpan.`,
    );
  }

  function reset() {
    void run(Object.fromEntries(SERVICE_ART_SLOTS.map((slot) => [slot.key, null])), () => {
      setArt({});
      return "Semua kartu kembali memakai ikon bawaan.";
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice
        tone="astra"
        icon={<IconSparkle size={15} />}
        title="Gambar kartu di halaman depan"
      >
        Empat kartu metode di beranda bisa memakai gambarmu sendiri. Kosongkan satu slot untuk
        memakai ikon bawaan lagi. Batas {Math.round(SERVICE_ART_MAX_BYTES / 1000)}KB per gambar,
        karena keempatnya ikut terkirim ke setiap pengunjung beranda.
      </Notice>

      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconSparkle size={15} />} title="Tidak tersimpan">
          {error}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
        {SERVICE_ART_SLOTS.map((slot, index) => (
          <div key={slot.key} className="bezel-shell p-1.5">
            <div className="bezel-core flex h-full flex-col gap-3 p-4 md:p-5">
              <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
                <span className="flex items-center gap-2">
                  <span className="num text-[10px] font-extrabold text-ink-mute">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="eyebrow text-ink-mute">{slot.label}</span>
                </span>
                <span className="num text-[10px] text-ink-mute">
                  {art[slot.key] ? "gambar kustom" : "ikon bawaan"}
                </span>
              </div>
              <ImagePicker
                label={slot.label}
                hint={slot.hint}
                maxBytes={SERVICE_ART_MAX_BYTES}
                value={art[slot.key] ?? null}
                onChange={(next) => {
                  setFlash(null);
                  setError(null);
                  setArt((prev) => ({ ...prev, [slot.key]: next }));
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex flex-wrap items-center justify-between gap-3 p-3">
          <span className="text-[11px] text-ink-mute">
            {changed.length
              ? `${changed.length} slot berubah dan belum disimpan.`
              : "Semua slot sama dengan yang tersimpan di server."}
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="button" onClick={save} disabled={pending || !changed.length}>
              {pending ? "Menyimpan…" : `Simpan${changed.length ? ` (${changed.length})` : ""}`}
            </Button>
            <Button type="button" variant="secondary" onClick={reset} disabled={pending}>
              <IconRefresh size={15} />
              Pakai ikon bawaan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
