import { gamepassPriceForNet, netRobuxForGamepassPrice } from "./format";
import type { Product } from "./types";

/**
 * Rate card: Rp per net Robux delivered. Cover-tax listings carry a service
 * margin. Every field is editable from the admin panel — quote functions take
 * a card so a change can be previewed before it is applied.
 */
export interface RateCard {
  /** Rp per net Robux for cover-tax listings */
  cover: number;
  /** Rp per net Robux for no-cover listings */
  noCover: number;
  /** volume discount tiers as fractions (2.000 / 5.000 / 10.000 net Robux) */
  volume: { at2000: number; at5000: number; at10000: number };
}

export const DEFAULT_RATE_CARD: RateCard = {
  cover: 145,
  noCover: 128,
  volume: { at2000: 0.02, at5000: 0.04, at10000: 0.06 },
};

function volumeDiscount(net: number, tiers: RateCard["volume"]): number {
  if (net >= 10000) return tiers.at10000;
  if (net >= 5000) return tiers.at5000;
  if (net >= 2000) return tiers.at2000;
  return 0;
}

/** Always rounds up so a quote is never lower than the raw maths — and never Rp 0. */
function roundToRupiah500(value: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value / 500) * 500;
}

export interface Quote {
  mode: "cover" | "no_cover";
  /** what the buyer types: net Robux (cover) or gamepass price (no cover) */
  input: number;
  /** Robux that actually land in the buyer's balance */
  netRobux: number;
  /** Robux value to set on the gamepass asset */
  gamepassPrice: number;
  /** what the buyer pays Blox Astra */
  totalIdr: number;
  /** effective price per delivered Robux */
  perRobux: number;
  /** amount the Roblox marketplace keeps */
  taxRobux: number;
  savingsIdr: number;
}

export function quoteRobux(
  mode: "cover" | "no_cover",
  input: number,
  card: RateCard = DEFAULT_RATE_CARD,
): Quote {
  const safeInput = Math.max(0, Math.floor(input || 0));

  if (mode === "cover") {
    const netRobux = safeInput;
    const gamepassPrice = gamepassPriceForNet(netRobux);
    const base = netRobux * card.cover;
    const totalIdr = roundToRupiah500(base * (1 - volumeDiscount(netRobux, card.volume)));
    return {
      mode,
      input: safeInput,
      netRobux,
      gamepassPrice,
      totalIdr,
      perRobux: netRobux > 0 ? totalIdr / netRobux : 0,
      taxRobux: gamepassPrice - netRobux,
      savingsIdr: roundToRupiah500(base - totalIdr),
    };
  }

  const gamepassPrice = safeInput;
  const netRobux = netRobuxForGamepassPrice(gamepassPrice);
  const base = netRobux * card.noCover;
  const totalIdr = roundToRupiah500(base * (1 - volumeDiscount(netRobux, card.volume)));
  return {
    mode,
    input: safeInput,
    netRobux,
    gamepassPrice,
    totalIdr,
    perRobux: netRobux > 0 ? totalIdr / netRobux : 0,
    taxRobux: gamepassPrice - netRobux,
    savingsIdr: roundToRupiah500(base - totalIdr),
  };
}

export type PricingMode = "cover" | "no_cover";

/**
 * What the buyer must type for a listing whose delivered amount is `netRobux`:
 * cover-tax listings quote the net figure, no-cover listings quote the raw
 * gamepass price the buyer is about to set.
 */
export function listingInput(netRobux: number, mode: PricingMode): number {
  return mode === "cover" ? netRobux : gamepassPriceForNet(netRobux);
}

/**
 * The single source of truth for a Robux listing's price. Catalog, buy box,
 * checkout and the homepage packs all quote through here so one product has
 * exactly one price anywhere in the app.
 */
export function listingQuote(
  netRobux: number,
  mode: PricingMode,
  quantity = 1,
  card: RateCard = DEFAULT_RATE_CARD,
): Quote {
  const qty = Math.max(1, Math.floor(quantity || 1));
  return quoteRobux(mode, listingInput(netRobux, mode) * qty, card);
}

/**
 * The price a listing should show under `card`. Non-robux listings have a
 * fixed price; robux listings are always re-quoted so one rate change moves
 * every robux tile at once.
 */
export function productPrice(
  product: Pick<Product, "price" | "netRobux" | "pricingMode">,
  card: RateCard = DEFAULT_RATE_CARD,
): number {
  if (!product.netRobux) return product.price;
  return listingQuote(product.netRobux, product.pricingMode ?? "cover", 1, card).totalIdr;
}

/** Same catalog, robux listings re-priced under `card` (used for sort/filter). */
export function repriceCatalog<T extends Pick<Product, "price" | "netRobux" | "pricingMode">>(
  items: readonly T[],
  card: RateCard = DEFAULT_RATE_CARD,
): T[] {
  return items.map((product) => ({ ...product, price: productPrice(product, card) }));
}
