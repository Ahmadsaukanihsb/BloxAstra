"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { saveSocialLinks } from "@/app/actions/admin";
import {
  isValidSocialUrl,
  SOCIAL_SLOTS,
  SOCIAL_URL_MAX,
  type SocialLinks,
  type SocialPlatformId,
} from "@/lib/social-links-slots";
import { RecordFrame } from "@/components/admin/console";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import {
  IconAlert,
  IconCheck,
  IconDiscord,
  IconFacebook,
  IconInstagram,
  IconTiktok,
  IconWhatsapp,
  IconXTwitter,
  IconYoutube,
} from "@/components/ui/icons";

const SOCIAL_ICONS: Record<
  SocialPlatformId,
  (props: { size?: number; className?: string }) => ReactNode
> = {
  discord: IconDiscord,
  instagram: IconInstagram,
  tiktok: IconTiktok,
  youtube: IconYoutube,
  facebook: IconFacebook,
  x: IconXTwitter,
  whatsapp: IconWhatsapp,
};

/**
 * Footer social links, one URL per platform, stored in the `site.social`
 * Setting row and read through `getSocialLinks()` in the footer, so saving
 * here updates every page without a deploy. An empty input removes the icon.
 */
export function SocialPanel({ initial }: { initial: SocialLinks }) {
  const router = useRouter();
  const [draft, setDraft] = useState<SocialLinks>(initial);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const invalid = SOCIAL_SLOTS.filter(
    (slot) => draft[slot.id].trim() !== "" && !isValidSocialUrl(slot.id, draft[slot.id]),
  );
  const active = SOCIAL_SLOTS.filter((slot) => isValidSocialUrl(slot.id, draft[slot.id]));

  async function apply() {
    setPending(true);
    setError(null);
    const result = await saveSocialLinks(draft);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFlash(
      active.length > 0
        ? `Tautan tersimpan. ${active.length} ikon tampil di footer.`
        : "Semua tautan kosong — footer tampil tanpa ikon sosial.",
    );
    router.refresh();
  }

  return (
    <RecordFrame>
      <span className="eyebrow text-ink-mute">Sosial media (footer)</span>

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

      {/* Live preview of how the footer row will look */}
      <div className="flex flex-wrap items-center gap-2 rounded-well border border-line bg-canvas-2 px-4 py-3">
        {active.length > 0 ? (
          active.map((slot) => {
            const Icon = SOCIAL_ICONS[slot.id];
            return (
              <span
                key={slot.id}
                title={slot.label}
                className="flex size-9 items-center justify-center rounded-full border border-line bg-paper"
              >
                <Icon size={18} />
              </span>
            );
          })
        ) : (
          <span className="text-[12px] text-ink-mute">
            Belum ada tautan — footer tampil tanpa ikon sosial.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {SOCIAL_SLOTS.map((slot) => {
          const value = draft[slot.id];
          const wrong = value.trim() !== "" && !isValidSocialUrl(slot.id, value);
          const Icon = SOCIAL_ICONS[slot.id];
          return (
            <Field
              key={slot.id}
              label={slot.label}
              htmlFor={`social-${slot.id}`}
              error={wrong ? `Harus URL https di domain ${slot.hosts.join(" atau ")}.` : null}
            >
              <div className="flex items-center gap-2">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-well border border-line bg-canvas-2">
                  <Icon size={17} />
                </span>
                <TextInput
                  id={`social-${slot.id}`}
                  value={value}
                  maxLength={SOCIAL_URL_MAX}
                  invalid={wrong}
                  placeholder={slot.placeholder}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, [slot.id]: event.target.value }))
                  }
                />
              </div>
            </Field>
          );
        })}
      </div>

      <span className="flex flex-wrap gap-2.5">
        <Button
          size="sm"
          leadingIcon={<IconCheck size={15} />}
          disabled={pending || !dirty || invalid.length > 0}
          onClick={() => void apply()}
        >
          {pending ? "Menyimpan..." : "Terapkan tautan sosial"}
        </Button>
      </span>
    </RecordFrame>
  );
}
