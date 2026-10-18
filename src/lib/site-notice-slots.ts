/**
 * Client-safe constants for the two admin-authored notices: the promo strip
 * above the navbar and the homepage pop-up. Kept apart from `site-notice.ts`
 * (which opens the database) so the admin editor can import the shapes and
 * budgets without pulling server-only modules into the client bundle.
 */

export const SITE_PROMO_KEY = "site.promo";
export const SITE_POPUP_KEY = "site.popup";

/**
 * The pop-up image rides on the homepage payload (it is the one image a
 * visitor may see before any scrolling), so it gets a tighter budget than a
 * product photo. 800KB still fits a 1200px illustration comfortably.
 */
export const SITE_POPUP_MAX_BYTES = 800_000;

export const PROMO_MESSAGE_MAX = 180;
export const NOTICE_CTA_LABEL_MAX = 30;
export const POPUP_TITLE_MAX = 80;
export const POPUP_MESSAGE_MAX = 400;

export interface SitePromo {
  enabled: boolean;
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface SitePopup {
  enabled: boolean;
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  /** Uploaded data URL or admin-pasted https URL; null = text-only pop-up. */
  image: string | null;
  /**
   * Bumped by the save action whenever the content actually changes. Visitors
   * dismiss a pop-up per version, so editing the text re-shows it once to
   * everyone — while saving twice without changes re-shows it to nobody.
   */
  version: string;
}

/** Matches the copy that shipped hard-coded, so nothing changes on first deploy. */
export const DEFAULT_SITE_PROMO: SitePromo = {
  enabled: true,
  message:
    "Bonus seller baru untuk orderan pertama. Dana ditahan platform, garansi pengembalian dana 100%",
  ctaLabel: "Klaim",
  ctaHref: "/daftar",
};

export const DEFAULT_SITE_POPUP: SitePopup = {
  enabled: false,
  title: "",
  message: "",
  ctaLabel: "Klaim",
  ctaHref: "/daftar",
  image: null,
  version: "",
};

/**
 * Notice links are either an internal path (`/daftar`) or an absolute https
 * URL. Anything else — `javascript:`, `data:`, protocol-relative `//host`,
 * embedded whitespace — falls back to the given value. Used on the read path
 * as well as on write: this string ends up in an `href`.
 */
export function normalizeNoticeHref(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 300) return fallback;
  if (raw.startsWith("/")) {
    if (raw.startsWith("//") || /\s/.test(raw)) return fallback;
    return raw;
  }
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

/** True when the value is a link this app is willing to render. */
export function isValidNoticeHref(value: unknown): boolean {
  return normalizeNoticeHref(value, "") !== "";
}
