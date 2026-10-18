import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { LANDING_SECTIONS, type LandingSectionId } from "@/lib/landing-sections-slots";

export { LANDING_SECTIONS, type LandingSectionId };

/**
 * Homepage section arrangement, editable from /admin (tab Beranda).
 *
 * The hero is NOT listed here — it is always first (page identity + the
 * checkout entry). Everything below it can be reordered or hidden.
 * Sanitized on every read, so a hand-edited or half-written setting can
 * never break the homepage: unknown ids are dropped, missing ones are
 * appended in default order.
 */

export const LANDING_SECTION_KEY = "landing.sections";

const KNOWN_IDS = LANDING_SECTIONS.map((section) => section.id);

export const DEFAULT_LANDING_ORDER: LandingSectionId[] = [...KNOWN_IDS];

export interface LandingLayout {
  /** section ids below the hero, top to bottom */
  order: LandingSectionId[];
  /** ids currently hidden (testimonials included — same as "hide reviews") */
  hidden: LandingSectionId[];
}

export const DEFAULT_LANDING_LAYOUT: LandingLayout = {
  order: DEFAULT_LANDING_ORDER,
  hidden: [],
};

/** Coerce an unknown value into a safe layout (never throws). */
export function parseLandingLayout(raw: string | null | undefined): LandingLayout {
  if (!raw) return DEFAULT_LANDING_LAYOUT;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_LANDING_LAYOUT;
    const { order, hidden } = parsed as { order?: unknown; hidden?: unknown };

    const cleanOrder = Array.isArray(order)
      ? [...new Set(order.filter((id): id is LandingSectionId => typeof id === "string" && (KNOWN_IDS as string[]).includes(id)))]
      : [];
    // Anything the admin did not send (new sections from a deploy) lands at
    // the end in default order rather than vanishing.
    for (const id of KNOWN_IDS) {
      if (!cleanOrder.includes(id)) cleanOrder.push(id);
    }
    const cleanHidden = Array.isArray(hidden)
      ? [...new Set(hidden.filter((id): id is LandingSectionId => typeof id === "string" && (KNOWN_IDS as string[]).includes(id)))]
      : [];
    return { order: cleanOrder, hidden: cleanHidden };
  } catch {
    return DEFAULT_LANDING_LAYOUT;
  }
}

/** Visible sections below the hero, top to bottom. */
export async function getLandingLayout(): Promise<LandingLayout> {
  "use cache";
  cacheTag("landing-layout");
  const row = await db.setting.findUnique({ where: { key: LANDING_SECTION_KEY } });
  return parseLandingLayout(row?.value);
}

/** Visible section ids in render order (hero excluded — always first). */
export function visibleSections(layout: LandingLayout): LandingSectionId[] {
  const hidden = new Set(layout.hidden);
  return layout.order.filter((id) => !hidden.has(id));
}
