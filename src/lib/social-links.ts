import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import {
  DEFAULT_SOCIAL_LINKS,
  normalizeSocialUrl,
  SOCIAL_LINKS_KEY,
  SOCIAL_SLOTS,
  type SocialLinks,
} from "@/lib/social-links-slots";

/**
 * Read side of the footer social links. One Setting row (`site.social`)
 * published into the site footer, so the admin edits them in the panel and
 * the footer follows without a deploy.
 *
 * Parsing is defensive and runs on every read as well as on write: the value
 * is a JSON blob that anything with database access could have edited by hand,
 * and every field ends up in an `href`.
 */

export function parseSocialLinks(raw: string | null | undefined): SocialLinks {
  const links: SocialLinks = { ...DEFAULT_SOCIAL_LINKS };
  if (!raw) return links;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") return links;
    const source = parsed as Record<string, unknown>;
    for (const slot of SOCIAL_SLOTS) {
      links[slot.id] = normalizeSocialUrl(slot.id, source[slot.id]);
    }
  } catch {
    return links;
  }
  return links;
}

/** Cached social links. Tagged so the admin action can drop it. */
export async function getSocialLinks(): Promise<SocialLinks> {
  "use cache";
  cacheTag("site-social");
  const row = await db.setting.findUnique({ where: { key: SOCIAL_LINKS_KEY } });
  return parseSocialLinks(row?.value);
}
