import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { validImageDataUrl } from "@/lib/images";
import { SITE_LOGO_KEY, SITE_LOGO_MAX_BYTES } from "@/lib/site-logo-slots";

export { SITE_LOGO_KEY, SITE_LOGO_MAX_BYTES };

/**
 * Read side of the site logo override. Same storage shape as every other
 * image in the app (a data URL in the database), so no static files or
 * deploys are involved when the admin swaps the brand.
 *
 * Empty (no row, or `{ image: null }`) means "use the built-in AstraMark".
 * Anything that is not a genuine image never leaves this module.
 */

export function parseSiteLogo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "string") {
      return validImageDataUrl(parsed, SITE_LOGO_MAX_BYTES) ? parsed : null;
    }
    if (parsed !== null && typeof parsed === "object" && "image" in parsed) {
      const image = (parsed as { image: unknown }).image;
      return typeof image === "string" && validImageDataUrl(image, SITE_LOGO_MAX_BYTES)
        ? image
        : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Custom logo data URL, or null for the built-in mark. */
export async function getSiteLogo(): Promise<string | null> {
  "use cache";
  cacheTag("site-logo");
  const row = await db.setting.findUnique({ where: { key: SITE_LOGO_KEY } });
  return parseSiteLogo(row?.value);
}
