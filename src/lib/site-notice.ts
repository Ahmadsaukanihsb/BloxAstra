import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { normalizeImageInput } from "@/lib/images";
import {
  DEFAULT_SITE_POPUP,
  DEFAULT_SITE_PROMO,
  normalizeNoticeHref,
  POPUP_MESSAGE_MAX,
  POPUP_TITLE_MAX,
  PROMO_MESSAGE_MAX,
  NOTICE_CTA_LABEL_MAX,
  SITE_POPUP_KEY,
  SITE_POPUP_MAX_BYTES,
  SITE_PROMO_KEY,
  type SitePopup,
  type SitePromo,
} from "@/lib/site-notice-slots";

/**
 * Read side of the admin-authored notices. Both live in Setting as JSON and
 * are published into the root layout (promo strip) and the homepage (pop-up),
 * so the admin can change or hide them without a deploy.
 *
 * Parsing is defensive and runs on every read as well as on write: the value
 * is a JSON blob that anything with database access could have edited by hand,
 * and both fields end up in rendered output (text, an `href`, an `src`).
 */

function clampText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function parseSitePromo(raw: string | null | undefined): SitePromo {
  if (!raw) return { ...DEFAULT_SITE_PROMO };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return { ...DEFAULT_SITE_PROMO };
    const source = parsed as Record<string, unknown>;
    return {
      enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SITE_PROMO.enabled,
      message: clampText(source.message, PROMO_MESSAGE_MAX) || DEFAULT_SITE_PROMO.message,
      ctaLabel: clampText(source.ctaLabel, NOTICE_CTA_LABEL_MAX) || DEFAULT_SITE_PROMO.ctaLabel,
      ctaHref: normalizeNoticeHref(source.ctaHref, DEFAULT_SITE_PROMO.ctaHref),
    };
  } catch {
    return { ...DEFAULT_SITE_PROMO };
  }
}

export function parseSitePopup(raw: string | null | undefined): SitePopup {
  if (!raw) return { ...DEFAULT_SITE_POPUP };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return { ...DEFAULT_SITE_POPUP };
    const source = parsed as Record<string, unknown>;
    return {
      enabled: typeof source.enabled === "boolean" ? source.enabled : DEFAULT_SITE_POPUP.enabled,
      title: clampText(source.title, POPUP_TITLE_MAX),
      message: clampText(source.message, POPUP_MESSAGE_MAX),
      ctaLabel: clampText(source.ctaLabel, NOTICE_CTA_LABEL_MAX) || DEFAULT_SITE_POPUP.ctaLabel,
      ctaHref: normalizeNoticeHref(source.ctaHref, DEFAULT_SITE_POPUP.ctaHref),
      image: normalizeImageInput(source.image ?? null, SITE_POPUP_MAX_BYTES),
      version: clampText(source.version, 40),
    };
  } catch {
    return { ...DEFAULT_SITE_POPUP };
  }
}

/** Cached promo strip. Tagged so the admin action can drop it. */
export async function getSitePromo(): Promise<SitePromo> {
  "use cache";
  cacheTag("site-promo");
  const row = await db.setting.findUnique({ where: { key: SITE_PROMO_KEY } });
  return parseSitePromo(row?.value);
}

/** Cached homepage pop-up. Tagged so the admin action can drop it. */
export async function getSitePopup(): Promise<SitePopup> {
  "use cache";
  cacheTag("site-popup");
  const row = await db.setting.findUnique({ where: { key: SITE_POPUP_KEY } });
  return parseSitePopup(row?.value);
}
