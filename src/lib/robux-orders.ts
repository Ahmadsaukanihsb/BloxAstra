import { gamepassPriceForNet, netRobuxForGamepassPrice } from "./format";

/**
 * Configuration for the three `/beli/robux-*` purchase flows.
 * These flows are sold by a different method than the catalog listings (the
 * buyer never has to wait for a seller to accept), so their rate card is
 * intentionally separate from `robux-pricing.ts`. Everything that quotes these
 * flows — the order pages, their quick packs, and the service rail — reads from
 * here so a rate only ever changes in one place.
 */
export type RobuxOrderKind = "username" | "login" | "gamepass" | "premium";

export interface RobuxOrderConfig {
  kind: RobuxOrderKind;
  /** short label used in the service rail */
  via: string;
  /** page that sells this method */
  href: string;
  /** rupiah per Robux */
  rate: number;
  adminFee: number;
  minRobux: number;
  maxRobux: number;
  /** slider granularity */
  step: number;
  initialRobux: number;
  quickPackRobux: readonly number[];
  /** highlighted in the service rail */
  badge: "diskon" | "terlaris";
}

export const ROBUX_ORDERS: Record<RobuxOrderKind, RobuxOrderConfig> = {
  username: {
    kind: "username",
    via: "Via Username",
    href: "/beli/robux-username",
    rate: 160,
    adminFee: 564,
    minRobux: 100,
    maxRobux: 5_000,
    step: 10,
    initialRobux: 500,
    quickPackRobux: [100, 500, 800, 1_700, 4_500],
    badge: "diskon",
  },
  login: {
    kind: "login",
    via: "Via Login",
    href: "/beli/robux-login",
    rate: 150,
    adminFee: 564,
    minRobux: 200,
    maxRobux: 10_000,
    step: 20,
    initialRobux: 1_000,
    quickPackRobux: [500, 1_000, 2_000, 5_000, 10_000],
    badge: "terlaris",
  },
  gamepass: {
    kind: "gamepass",
    via: "Via Gamepass",
    href: "/beli/robux-gamepass",
    rate: 89.6,
    adminFee: 564,
    minRobux: 500,
    maxRobux: 20_000,
    step: 50,
    initialRobux: 1_000,
    quickPackRobux: [500, 1_000, 2_000, 5_000, 10_000],
    badge: "terlaris",
  },
  premium: {
    kind: "premium",
    via: "Roblox Premium",
    href: "/beli/premium",
    // Premium is sold per month, not per Robux — the "rate" is the monthly
    // price once a rate card is applied.
    rate: 185_000,
    adminFee: 564,
    minRobux: 1,
    maxRobux: 12,
    step: 1,
    initialRobux: 1,
    quickPackRobux: [1, 3, 12],
    badge: "diskon",
  },
};

/** Rate card for the three `/beli/robux-*` flows — editable from the admin panel. */
export interface RobuxOrderRates {
  username: number;
  login: number;
  gamepass: number;
  /** Rp per month for the Premium flow. */
  premium: number;
  adminFee: number;
}

export const DEFAULT_ORDER_RATES: RobuxOrderRates = {
  username: ROBUX_ORDERS.username.rate,
  login: ROBUX_ORDERS.login.rate,
  gamepass: ROBUX_ORDERS.gamepass.rate,
  premium: ROBUX_ORDERS.premium.rate,
  adminFee: ROBUX_ORDERS.username.adminFee,
};

/** Flow config with the current (possibly admin-adjusted) rate card applied. */
export function robuxOrderConfig(
  kind: RobuxOrderKind,
  rates: RobuxOrderRates = DEFAULT_ORDER_RATES,
): RobuxOrderConfig {
  return { ...ROBUX_ORDERS[kind], rate: rates[kind], adminFee: rates.adminFee };
}

/** Price of `robux` on this flow, admin fee excluded. */
export function robuxOrderPrice(config: RobuxOrderConfig, robux: number): number {
  const amount = Math.max(0, Math.floor(robux || 0));
  return Math.round(amount * config.rate);
}

/**
 * Who swallows Roblox's 30% marketplace cut on the gamepass flow.
 *
 * `cover`   — Blox Astra grosses the gamepass asset up so the buyer receives
 *             exactly the Robux they picked. The buyer is charged for the net
 *             figure only.
 * `no_cover`— the buyer sets the raw gamepass price and eats the 30% cut. They
 *             are charged on the raw gamepass figure, so the delivered Robux is
 *             lower than the number they typed.
 */
export type GamepassTaxMode = "cover" | "no_cover";

export const GAMEPASS_TAX_MODE_LABEL: Record<GamepassTaxMode, string> = {
  cover: "Pajak 30% Ditanggung Blox Astra",
  no_cover: "Saya Tanggung Pajak 30%",
};

export interface GamepassQuote {
  mode: GamepassTaxMode;
  /** what the buyer typed: net Robux (cover) or raw gamepass price (no_cover) */
  input: number;
  /** Robux that land in the buyer's balance */
  netRobux: number;
  /** Robux value to set on the gamepass asset */
  gamepassPrice: number;
  /** billable Robux the rate card is applied to */
  billableRobux: number;
  /** Robux the Roblox marketplace keeps */
  taxRobux: number;
}

/**
 * Where the two tax modes actually diverge. `gamepassPriceForNet` grosses up so
 * a gamepass of P nets P×0.7; `netRobuxForGamepassPrice` walks it back.
 */
export function gamepassQuote(mode: GamepassTaxMode, input: number): GamepassQuote {
  const safe = Math.max(0, Math.floor(input || 0));
  if (mode === "cover") {
    const netRobux = safe;
    const gamepassPrice = gamepassPriceForNet(netRobux);
    return {
      mode,
      input: safe,
      netRobux,
      gamepassPrice,
      billableRobux: netRobux,
      taxRobux: gamepassPrice - netRobux,
    };
  }
  const gamepassPrice = safe;
  const netRobux = netRobuxForGamepassPrice(gamepassPrice);
  return {
    mode,
    input: safe,
    netRobux,
    gamepassPrice,
    // Buyer is charged on the raw gamepass figure, not on what they receive.
    billableRobux: gamepassPrice,
    taxRobux: gamepassPrice - netRobux,
  };
}

/** Price of a gamepass order under a tax mode — the single source of truth. */
export function gamepassOrderPrice(config: RobuxOrderConfig, quote: GamepassQuote): number {
  return robuxOrderPrice(config, quote.billableRobux);
}

/** Premium term plans. `discount` is applied to `months × monthlyRate`. */
export const PREMIUM_PLANS: ReadonlyArray<{
  months: number;
  label: string;
  discount: number;
  badge: string | null;
}> = [
  { months: 1, label: "1 Bulan", discount: 0, badge: null },
  { months: 3, label: "3 Bulan", discount: 0.15, badge: "Hemat 15%" },
  { months: 12, label: "12 Bulan", discount: 1 / 6, badge: "Paling hemat" },
];

/**
 * Robux Premium subtotal for a whole number of months. The buyer is charged the
 * monthly rate times the term, less the plan's discount — the same maths the
 * client renders, resolved server-side so the price cannot be tampered with.
 */
export function premiumSubtotal(monthlyRate: number, months: number): number {
  const term = Math.min(12, Math.max(1, Math.floor(months || 1)));
  const plan = PREMIUM_PLANS.find((p) => p.months === term) ?? PREMIUM_PLANS[0];
  return Math.round(monthlyRate * plan.months * (1 - plan.discount));
}

/** Total the buyer pays on this flow: robux + admin fee. */
export function robuxOrderTotal(config: RobuxOrderConfig, robux: number): number {
  return robuxOrderPrice(config, robux) + config.adminFee;
}
