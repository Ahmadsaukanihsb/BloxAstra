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
  /** Gamepass with cover tax: Blox Astra swallows Roblox's 30% cut — Rp per net Robux. */
  gamepassCover: number;
  /** Gamepass with no cover tax: the buyer swallows the cut — Rp per raw gamepass Robux. */
  gamepassNoCover: number;
  /** Rp per month for the Premium flow. */
  premium: number;
  adminFee: number;
}

/**
 * Roblox keeps 30% of every gamepass sale. When the buyer bears that cut the
 * raw gamepass price buys only 70% of it as net Robux, so this rate has to be
 * 30% under the cover-tax rate for the same net Robux to cost the same rupiah.
 */
const GAMEPASS_NO_COVER_RATE = Math.round(ROBUX_ORDERS.gamepass.rate * 0.7 * 100) / 100; // 62.72

export const DEFAULT_ORDER_RATES: RobuxOrderRates = {
  username: ROBUX_ORDERS.username.rate,
  login: ROBUX_ORDERS.login.rate,
  gamepassCover: ROBUX_ORDERS.gamepass.rate,
  gamepassNoCover: GAMEPASS_NO_COVER_RATE,
  premium: ROBUX_ORDERS.premium.rate,
  adminFee: ROBUX_ORDERS.username.adminFee,
};

/** The gamepass rate that matches who swallows Roblox's 30% cut. */
export function gamepassRate(rates: RobuxOrderRates, mode: GamepassTaxMode): number {
  return mode === "no_cover" ? rates.gamepassNoCover : rates.gamepassCover;
}

/** Flow config with the current (possibly admin-adjusted) rate card applied. */
export function robuxOrderConfig(
  kind: RobuxOrderKind,
  rates: RobuxOrderRates = DEFAULT_ORDER_RATES,
  taxMode: GamepassTaxMode = "cover",
): RobuxOrderConfig {
  const rate = kind === "gamepass" ? gamepassRate(rates, taxMode) : rates[kind];
  return { ...ROBUX_ORDERS[kind], rate, adminFee: rates.adminFee };
}

/** Price of `robux` on this flow, admin fee excluded. */
export function robuxOrderPrice(config: RobuxOrderConfig, robux: number): number {
  const amount = Math.max(0, Math.floor(robux || 0));
  return Math.round(amount * config.rate);
}

/**
 * The one query key that carries a chosen nominal from the lobby into a buy
 * flow. Only the key — the parsing and clamping live below, so the hero and the
 * order pages can never disagree about what a valid nominal is.
 */
export const ROBUX_AMOUNT_PARAM = "robux";

/**
 * Snap a nominal onto this flow's grid and keep it inside its min/max. Anything
 * unreadable (NaN, empty) falls back to the flow's initial nominal, so a link
 * with a mangled parameter lands on the normal default instead of 0 Robux.
 */
export function clampRobuxAmount(config: RobuxOrderConfig, value: unknown): number {
  // A repeated query key arrives as an array — take the first value, never NaN.
  const source = Array.isArray(value) ? value[0] : value;
  const raw = typeof source === "string" ? Number(source.replace(/[^0-9]/g, "")) : Number(source);
  if (!Number.isFinite(raw) || raw <= 0) return config.initialRobux;
  const stepped = Math.round(raw / config.step) * config.step;
  return Math.min(config.maxRobux, Math.max(config.minRobux, stepped));
}

/**
 * Buy-flow link for a given nominal. The amount rides in the query string so the
 * number the buyer already dialled in the lobby is still there on the order page
 * — clicking "lanjut beli" must never throw their choice away.
 */
export function robuxOrderHref(config: RobuxOrderConfig, robux?: number): string {
  if (robux === undefined) return config.href;
  return `${config.href}?${ROBUX_AMOUNT_PARAM}=${clampRobuxAmount(config, robux)}`;
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
