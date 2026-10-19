/**
 * Slot definitions for the homepage shelf artwork.
 *
 * Kept apart from `service-art.ts` on purpose: that module opens the database
 * and calls `cacheTag`, so importing it from a client component would drag
 * Prisma into the browser bundle. The admin editor and the rail only need these
 * constants, so they live here where both sides can read them.
 */

/**
 * Setting row key. One JSON object, `{ [slotKey]: "data:image/…;base64,…" }`.
 */
export const SERVICE_ART_KEY = "landing.serviceArt";

/**
 * Per-slot ceiling, measured after base64 decoding.
 *
 * Well under the 1.5MB the pickers allow elsewhere, because these images ride
 * inside the homepage payload: at 1.5MB each, four of them would put 6MB of
 * base64 in front of every visitor on the busiest page of the site.
 */
export const SERVICE_ART_MAX_BYTES = 160_000;

/**
 * The slots an admin can set, in the order the shelf shows them. Keys match the
 * `ServiceCard.key` values the rail builds for the `/beli/*` flows — that pairing
 * is what makes an upload land on the right tile.
 */
export const SERVICE_ART_SLOTS = [
  {
    key: "robux-username",
    label: "Robux via Username",
    hint: "Kotak 1:1, disarankan PNG latar transparan.",
  },
  {
    key: "robux-login",
    label: "Robux via Login",
    hint: "Kotak 1:1, disarankan PNG latar transparan.",
  },
  {
    key: "robux-gamepass",
    label: "Robux via Gamepass",
    hint: "Kotak 1:1, disarankan PNG latar transparan.",
  },
  {
    key: "premium",
    label: "Roblox Premium",
    hint: "Kotak 1:1, disarankan PNG latar transparan.",
  },
] as const;

export type ServiceArtKey = (typeof SERVICE_ART_SLOTS)[number]["key"];

export type ServiceArt = Partial<Record<ServiceArtKey, string>>;

export function isServiceArtKey(value: string): value is ServiceArtKey {
  return SERVICE_ART_SLOTS.some((slot) => slot.key === value);
}

/**
 * Maps an `Order.kind` onto the shelf-art slot of its service, so surfaces that
 * show a tile for a non-catalog order (the order room's fund panel) can fall
 * back to the artwork the admin uploaded for that card. Catalog orders carry
 * kind "catalog" and map to nothing.
 */
export function serviceArtSlotForKind(kind: string): ServiceArtKey | null {
  switch (kind) {
    case "robux_username":
      return "robux-username";
    case "robux_login":
      return "robux-login";
    case "robux_gamepass":
      return "robux-gamepass";
    case "premium":
      return "premium";
    default:
      return null;
  }
}
