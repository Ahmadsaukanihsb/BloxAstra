import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { normalizeImageInput } from "@/lib/images";
import {
  isServiceArtKey,
  SERVICE_ART_KEY,
  SERVICE_ART_MAX_BYTES,
  type ServiceArt,
} from "@/lib/service-art-slots";

/**
 * Read side of the homepage shelf artwork overrides. The slot constants and
 * their budget live in `service-art-slots.ts`, which is safe to import from the
 * browser; this module is not, because it opens the database.
 *
 * The images are stored as data URLs, matching how every other image in this app
 * is kept (`User.avatarImage`, the KYC documents, `Product.imageUrl`).
 */

/**
 * Keeps only known slots holding a genuine image — either an uploaded data URL
 * or an admin-pasted https URL.
 *
 * Runs on every read as well as on write, because the value comes back out of a
 * JSON blob that anything with database access could have edited by hand — a
 * string that is not an image (or is a `javascript:`/http link) must never reach
 * an `src`.
 */
export function sanitizeServiceArt(input: unknown): ServiceArt {
  if (typeof input !== "object" || input === null) return {};
  const art: ServiceArt = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!isServiceArtKey(key)) continue;
    const normalized = normalizeImageInput(value, SERVICE_ART_MAX_BYTES);
    if (!normalized) continue;
    art[key] = normalized;
  }
  return art;
}

export function parseServiceArt(raw: string | null | undefined): ServiceArt {
  if (!raw) return {};
  try {
    return sanitizeServiceArt(JSON.parse(raw));
  } catch {
    return {};
  }
}

/** Cached reader for the homepage shelf. Tagged so the admin action can drop it. */
export async function getServiceArt(): Promise<ServiceArt> {
  "use cache";
  cacheTag("service-art");
  const row = await db.setting.findUnique({ where: { key: SERVICE_ART_KEY } });
  return parseServiceArt(row?.value);
}
