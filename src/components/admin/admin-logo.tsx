"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSiteLogo, saveSiteFavicon } from "@/app/actions/admin";
import { SITE_LOGO_MAX_BYTES } from "@/lib/site-logo-slots";
import { SITE_FAVICON_MAX_BYTES } from "@/lib/site-favicon-slots";
import { RecordFrame } from "@/components/admin/console";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { ImagePicker } from "@/components/ui/image-picker";
import { BrandMark } from "@/components/site/brand-mark";
import { IconAlert, IconCheck } from "@/components/ui/icons";

/**
 * Site logo editor. Upload once — the header, footer, dashboard rail and
 * auth pages switch to it without a deploy. Empty = built-in mark.
 */
export function LogoPanel({
  initial,
  initialFavicon,
}: {
  initial: string | null;
  initialFavicon: string | null;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<string | null>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const [faviconDraft, setFaviconDraft] = useState<string | null>(initialFavicon);
  const [faviconFlash, setFaviconFlash] = useState<string | null>(null);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconPending, setFaviconPending] = useState(false);

  const dirty = (draft ?? null) !== (initial ?? null);
  const faviconDirty = (faviconDraft ?? null) !== (initialFavicon ?? null);

  async function apply() {
    setPending(true);
    setError(null);
    const result = await saveSiteLogo({ image: draft });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(draft ? "Logo baru aktif di seluruh situs." : "Logo dikembalikan ke bawaan.");
    router.refresh();
  }

  async function applyFavicon() {
    setFaviconPending(true);
    setFaviconError(null);
    const result = await saveSiteFavicon({ image: faviconDraft });
    setFaviconPending(false);
    if (!result.ok) {
      setFaviconError(result.error);
      return;
    }
    setFaviconFlash(
      faviconDraft ? "Favicon baru aktif di tab browser." : "Favicon dikembalikan ke bawaan.",
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {flash ? (
        <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan">
          {flash}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
          {error}
        </Notice>
      ) : null}

      <RecordFrame>
        <span className="eyebrow text-ink-mute">Logo situs</span>
        <div className="flex items-center gap-4 rounded-well bg-canvas-2 p-4">
          <BrandMark logo={draft} size={32} />
          <span className="text-[11px] leading-relaxed text-ink-mute">
            Pratinjau ukuran header. Gambar tinggi-terkunci: logo lebar menyusut
            mengikuti bilah, logo kotak tampil seperti mark bawaan.
          </span>
        </div>
        <ImagePicker
          value={draft}
          onChange={setDraft}
          label="File logo"
          hint={`PNG/JPG/GIF/WebP, maksimal ${Math.round(SITE_LOGO_MAX_BYTES / 1000)}KB. Dikosongkan = kembali ke mark bawaan.`}
          maxBytes={SITE_LOGO_MAX_BYTES}
        />
        <span className="flex flex-wrap gap-2.5">
          <Button size="sm" leadingIcon={<IconCheck size={15} />} disabled={pending || !dirty} onClick={() => void apply()}>
            {pending ? "Menyimpan…" : "Terapkan logo"}
          </Button>
          {draft ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDraft(null)}>
              Kembali ke bawaan
            </Button>
          ) : null}
        </span>
      </RecordFrame>

      <RecordFrame>
        <span className="eyebrow text-ink-mute">Favicon (ikon tab browser)</span>
        {faviconFlash ? (
          <Notice tone="astra" icon={<IconCheck size={15} />} title="Tersimpan">
            {faviconFlash}
          </Notice>
        ) : null}
        {faviconError ? (
          <Notice tone="danger" icon={<IconAlert size={15} />} title="Gagal">
            {faviconError}
          </Notice>
        ) : null}
        <div className="flex items-center gap-4 rounded-well bg-canvas-2 p-4">
          <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-control bg-canvas outline outline-1 -outline-offset-1 outline-line">
            {faviconDraft ? (
              // eslint-disable-next-line @next/next/no-img-element -- data-URL preview.
              <img src={faviconDraft} alt="" className="size-full object-contain" />
            ) : (
              <BrandMark logo={null} size={18} />
            )}
          </span>
          <span className="text-[11px] leading-relaxed text-ink-mute">
            Muncul di tab browser dan bookmark. Disarankan persegi (mis. 180×180 atau 512×512).
            Dikosongkan = mark bawaan.
          </span>
        </div>
        <ImagePicker
          value={faviconDraft}
          onChange={setFaviconDraft}
          label="File favicon"
          hint={`PNG/JPG/GIF/WebP, maksimal ${Math.round(SITE_FAVICON_MAX_BYTES / 1000)}KB. Gambar besar dikompres otomatis.`}
          maxBytes={SITE_FAVICON_MAX_BYTES}
        />
        <span className="flex flex-wrap gap-2.5">
          <Button
            size="sm"
            leadingIcon={<IconCheck size={15} />}
            disabled={faviconPending || !faviconDirty}
            onClick={() => void applyFavicon()}
          >
            {faviconPending ? "Menyimpan..." : "Terapkan favicon"}
          </Button>
          {faviconDraft ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={faviconPending}
              onClick={() => setFaviconDraft(null)}
            >
              Kembali ke bawaan
            </Button>
          ) : null}
        </span>
      </RecordFrame>

      <Notice tone="info" icon={<IconAlert size={15} />} title="Catatan">
        Gambar pratinjau tautan (saat link dibagikan ke media sosial) belum bisa diubah dari sini —
        itu masih file statis yang diganti lewat deploy.
      </Notice>
    </div>
  );
}
