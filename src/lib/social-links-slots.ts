/**
 * Client-safe constants for the footer social links the admin maintains from
 * the panel. Kept apart from `social-links.ts` (which opens the database) so
 * the admin editor can import shapes and validation without pulling
 * server-only modules into the client bundle.
 *
 * Links live in one `site.social` Setting row. Each slot accepts only an
 * https URL on the platform's own domain — Discord invite, an Instagram
 * profile, the shop's WhatsApp number — so a typo cannot turn the footer into
 * a link to somewhere else. An empty slot is simply not rendered.
 */

export const SOCIAL_LINKS_KEY = "site.social";
export const SOCIAL_URL_MAX = 300;
export const SOCIAL_LABEL_MAX = 30;

export type SocialPlatformId =
  | "discord"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "x"
  | "whatsapp";

export interface SocialLinkSlot {
  id: SocialPlatformId;
  label: string;
  /** Example URL shown in the admin input. */
  placeholder: string;
  /**
   * Hostnames the link may use. Exact match or a subdomain of one of these;
   * `chat.whatsapp.com` passes for `whatsapp.com`, `evil-instagram.com` does
   * not pass for `instagram.com`.
   */
  hosts: string[];
}

export const SOCIAL_SLOTS: readonly SocialLinkSlot[] = [
  {
    id: "discord",
    label: "Discord",
    placeholder: "https://discord.gg/…",
    hosts: ["discord.gg", "discord.com"],
  },
  {
    id: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/…",
    hosts: ["instagram.com"],
  },
  {
    id: "tiktok",
    label: "TikTok",
    placeholder: "https://tiktok.com/@…",
    hosts: ["tiktok.com"],
  },
  {
    id: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@…",
    hosts: ["youtube.com", "youtu.be"],
  },
  {
    id: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/…",
    hosts: ["facebook.com", "fb.com"],
  },
  {
    id: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/…",
    hosts: ["x.com", "twitter.com"],
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    placeholder: "https://wa.me/628… atau https://chat.whatsapp.com/…",
    hosts: ["wa.me", "whatsapp.com"],
  },
];

/** One URL per platform; "" = not set, the icon is not rendered. */
export type SocialLinks = Record<SocialPlatformId, string>;

export const DEFAULT_SOCIAL_LINKS: SocialLinks = {
  discord: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  facebook: "",
  x: "",
  whatsapp: "",
};

/**
 * Returns the link if it is an https URL on the platform's domain, else "".
 * Runs on the read path as well as on write: the value is a JSON blob that
 * anything with database access could have edited by hand, and it ends up in
 * the footer's `href`.
 */
export function normalizeSocialUrl(platform: SocialPlatformId, value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (raw.length === 0 || raw.length > SOCIAL_URL_MAX) return "";
  const slot = SOCIAL_SLOTS.find((item) => item.id === platform);
  if (!slot) return "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  const host = url.hostname.toLowerCase();
  const onOwnDomain = slot.hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  if (!onOwnDomain) return "";
  return url.toString();
}

/** True when the value is a link this app is willing to render. */
export function isValidSocialUrl(platform: SocialPlatformId, value: unknown): boolean {
  return normalizeSocialUrl(platform, value) !== "";
}

/** First host of a slot, for admin error messages. */
export function socialHostHint(platform: SocialPlatformId): string {
  return SOCIAL_SLOTS.find((item) => item.id === platform)?.hosts[0] ?? "";
}
