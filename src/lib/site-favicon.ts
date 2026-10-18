import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { validImageDataUrl } from "@/lib/images";
import { SITE_FAVICON_KEY, SITE_FAVICON_MAX_BYTES } from "@/lib/site-favicon-slots";

export { SITE_FAVICON_KEY, SITE_FAVICON_MAX_BYTES };

/**
 * Read side of the favicon override. Same storage shape as the site logo (a
 * data URL in the database), so swapping the tab icon needs no deploy.
 *
 * Returns the data URL or null for "no custom icon". Anything that is not a
 * genuine raster image never leaves this module — an `src`/`href` is built from
 * this, so a hand-edited database row must not be able to inject a script or an
 * SVG payload.
 */

export function parseSiteFavicon(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const image =
      typeof parsed === "string"
        ? parsed
        : parsed !== null && typeof parsed === "object" && "image" in parsed
          ? (parsed as { image: unknown }).image
          : null;
    return typeof image === "string" && validImageDataUrl(image, SITE_FAVICON_MAX_BYTES)
      ? image
      : null;
  } catch {
    return null;
  }
}

/** Custom favicon data URL, or null for the built-in mark. */
export async function getSiteFavicon(): Promise<string | null> {
  "use cache";
  cacheTag("site-favicon");
  const row = await db.setting.findUnique({ where: { key: SITE_FAVICON_KEY } });
  return parseSiteFavicon(row?.value);
}

/**
 * MIME type of a stored favicon data URL, for the serving route's Content-Type.
 * Falls back to PNG — the only sensible default for a tab icon.
 */
export function faviconMimeType(dataUrl: string): string {
  const match = /^data:([a-z/+.-]+);base64,/i.exec(dataUrl);
  return match ? match[1] : "image/png";
}
