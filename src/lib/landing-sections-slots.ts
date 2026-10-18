/**
 * Client-safe section catalogue. Kept apart from `landing-sections.ts`
 * (which opens the database) so the admin editor can import the labels
 * without pulling server-only modules into the client bundle.
 */

export const LANDING_SECTIONS = [
  { id: "testimonials", label: "Ulasan pembeli" },
  { id: "howto", label: "Cara pesan" },
  { id: "games", label: "Game" },
  { id: "services", label: "Top up instan" },
  { id: "packs", label: "Paket Robux penjual" },
  { id: "premium", label: "Premium" },
  { id: "limited", label: "Koleksi & kode" },
  { id: "featured", label: "Listing pilihan" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];
