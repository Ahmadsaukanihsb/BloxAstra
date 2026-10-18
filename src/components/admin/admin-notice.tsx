"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSitePopup, saveSitePromo } from "@/app/actions/admin";
import {
  isValidNoticeHref,
  NOTICE_CTA_LABEL_MAX,
  POPUP_MESSAGE_MAX,
  POPUP_TITLE_MAX,
  PROMO_MESSAGE_MAX,
  SITE_POPUP_MAX_BYTES,
  type SitePopup,
  type SitePromo,
} from "@/lib/site-notice-slots";
import { RecordFrame } from "@/components/admin/console";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, TextArea, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { ImagePicker } from "@/components/ui/image-picker";
import { IconAlert, IconCheck, RobuxGlyph } from "@/components/ui/icons";

/**
 * The two admin-authored notices, side by side in one tab:
 *   1. the promo strip above the navbar (layout-wide), and
 *   2. the homepage pop-up, which shows once per visitor per version.
 * Both are plain Setting rows read through cached getters, so saving here
 * changes the live site without a deploy.
 */
export function NoticePanel({
  initialPromo,
  initialPopup,
}: {
  initialPromo: SitePromo;
  initialPopup: SitePopup;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PromoEditor initial={initialPromo} />
      <PopupEditor initial={initialPopup} />
    </div>
  );
}

function PromoEditor({ initial }: { initial: SitePromo }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SitePromo>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const hrefOk = isValidNoticeHref(draft.ctaHref);

  async function apply() {
    setPending(true);
    setError(null);
    const result = await saveSitePromo(draft);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(draft.enabled ? "Bilah promo tersimpan dan tampil di situs." : "Bilah promo disembunyikan.");
    router.refresh();
  }

  return (
    <RecordFrame>
      <span className="eyebrow text-ink-mute">Bilah promo (strip merah di paling atas)</span>

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

      {/* Live preview of the actual strip */}
      <div className="overflow-hidden rounded-well bg-astra">
        <div className="flex items-center justify-center gap-3 px-4 py-2">
          <RobuxGlyph size={14} className="shrink-0 text-white" />
          <p className="truncate text-[12px] font-bold text-white">
            {draft.message || "Pesan bilah tampil di sini"}
          </p>
          <span className="shrink-0 rounded-tag bg-canvas-2 px-2.5 py-1 tag text-ink">
            {draft.ctaLabel || "Klaim"}
          </span>
        </div>
      </div>

      <Checkbox
        id="promo-enabled"
        checked={draft.enabled}
        onChange={(next) => setDraft((prev) => ({ ...prev, enabled: next }))}
        label="Tampilkan bilah di atas situs"
        description="Muncul di semua halaman publik. Penjual yang sudah aktif tidak melihatnya (pesan rekrutmen)."
      />

      <Field label="Pesan" htmlFor="promo-message">
        <TextInput
          id="promo-message"
          value={draft.message}
          maxLength={PROMO_MESSAGE_MAX}
          onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label tombol" htmlFor="promo-cta-label">
          <TextInput
            id="promo-cta-label"
            value={draft.ctaLabel}
            maxLength={NOTICE_CTA_LABEL_MAX}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: event.target.value }))}
          />
        </Field>
        <Field
          label="Tautan tombol"
          htmlFor="promo-cta-href"
          error={!hrefOk ? "Harus path internal (mis. /daftar) atau URL https." : null}
          hint="Contoh: /daftar, /katalog, atau https://…"
        >
          <TextInput
            id="promo-cta-href"
            value={draft.ctaHref}
            invalid={!hrefOk}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaHref: event.target.value }))}
          />
        </Field>
      </div>

      <span className="flex flex-wrap gap-2.5">
        <Button
          size="sm"
          leadingIcon={<IconCheck size={15} />}
          disabled={pending || !dirty || !hrefOk}
          onClick={() => void apply()}
        >
          {pending ? "Menyimpan..." : "Terapkan bilah"}
        </Button>
      </span>
    </RecordFrame>
  );
}

function PopupEditor({ initial }: { initial: SitePopup }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SitePopup>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = JSON.stringify({ ...draft, version: "" }) !== JSON.stringify({ ...initial, version: "" });
  const hrefOk = isValidNoticeHref(draft.ctaHref);

  async function apply() {
    setPending(true);
    setError(null);
    const result = await saveSitePopup({
      enabled: draft.enabled,
      title: draft.title,
      message: draft.message,
      ctaLabel: draft.ctaLabel,
      ctaHref: draft.ctaHref,
      image: draft.image,
    });
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(
      draft.enabled
        ? "Pop up tersimpan. Pengunjung melihatnya sekali (versi baru)."
        : "Pop up dimatikan.",
    );
    router.refresh();
  }

  return (
    <RecordFrame>
      <span className="eyebrow text-ink-mute">Pop up beranda</span>

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

      <Checkbox
        id="popup-enabled"
        checked={draft.enabled}
        onChange={(next) => setDraft((prev) => ({ ...prev, enabled: next }))}
        label="Tampilkan pop up saat pengunjung membuka beranda"
        description="Tampil sekali per pengunjung. Setiap kali isinya diubah dan disimpan, pengunjung akan melihatnya sekali lagi — menyimpan tanpa perubahan tidak mengulanginya."
      />

      <ImagePicker
        value={draft.image}
        onChange={(next) => setDraft((prev) => ({ ...prev, image: next }))}
        label="Gambar (opsional)"
        hint={`PNG/JPG/GIF/WebP maksimal ${Math.round(SITE_POPUP_MAX_BYTES / 1000)}KB, atau tempel URL. Kosongkan untuk pop up teks saja.`}
        maxBytes={SITE_POPUP_MAX_BYTES}
      />

      <Field label="Judul" htmlFor="popup-title">
        <TextInput
          id="popup-title"
          value={draft.title}
          maxLength={POPUP_TITLE_MAX}
          placeholder="mis. Promo minggu ini"
          onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
        />
      </Field>

      <Field
        label="Pesan"
        htmlFor="popup-message"
        hint="Boleh beberapa baris. Baris baru ditampilkan apa adanya."
      >
        <TextArea
          id="popup-message"
          value={draft.message}
          maxLength={POPUP_MESSAGE_MAX}
          placeholder="mis. Diskon biaya layanan untuk semua order Robux sampai Minggu ini."
          onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Label tombol" htmlFor="popup-cta-label">
          <TextInput
            id="popup-cta-label"
            value={draft.ctaLabel}
            maxLength={NOTICE_CTA_LABEL_MAX}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaLabel: event.target.value }))}
          />
        </Field>
        <Field
          label="Tautan tombol"
          htmlFor="popup-cta-href"
          error={!hrefOk ? "Harus path internal (mis. /daftar) atau URL https." : null}
          hint="Contoh: /katalog, /daftar, atau https://…"
        >
          <TextInput
            id="popup-cta-href"
            value={draft.ctaHref}
            invalid={!hrefOk}
            onChange={(event) => setDraft((prev) => ({ ...prev, ctaHref: event.target.value }))}
          />
        </Field>
      </div>

      <span className="flex flex-wrap gap-2.5">
        <Button
          size="sm"
          leadingIcon={<IconCheck size={15} />}
          disabled={pending || !dirty || !hrefOk}
          onClick={() => void apply()}
        >
          {pending ? "Menyimpan..." : "Terapkan pop up"}
        </Button>
      </span>
    </RecordFrame>
  );
}
