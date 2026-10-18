import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_RATES,
  ROBUX_AMOUNT_PARAM,
  clampRobuxAmount,
  gamepassQuote,
  gamepassRate,
  premiumSubtotal,
  robuxOrderConfig,
  robuxOrderHref,
  robuxOrderPrice,
  robuxOrderTotal,
  type RobuxOrderConfig,
} from "@/lib/robux-orders";

const CONFIG: RobuxOrderConfig = {
  kind: "username",
  via: "Via Username",
  href: "/beli/robux-username",
  rate: 160,
  adminFee: 564,
  minRobux: 100,
  maxRobux: 5_000,
  step: 10,
  initialRobux: 500,
  quickPackRobux: [100, 500],
  badge: "diskon",
};

describe("robuxOrderPrice / robuxOrderTotal", () => {
  it("multiplies floored robux by the rate", () => {
    expect(robuxOrderPrice(CONFIG, 500)).toBe(80000);
    expect(robuxOrderPrice(CONFIG, 0)).toBe(0);
    expect(robuxOrderPrice(CONFIG, -10)).toBe(0);
  });

  it("adds the flat admin fee on top", () => {
    expect(robuxOrderTotal(CONFIG, 500)).toBe(80564);
  });
});

describe("clampRobuxAmount / robuxOrderHref", () => {
  it("snaps a nominal onto the flow's step and keeps it in range", () => {
    expect(clampRobuxAmount(CONFIG, 1700)).toBe(1700);
    expect(clampRobuxAmount(CONFIG, "1700")).toBe(1700);
    expect(clampRobuxAmount(CONFIG, 1234)).toBe(1230);
    expect(clampRobuxAmount(CONFIG, 50)).toBe(100);
    expect(clampRobuxAmount(CONFIG, 999_999)).toBe(5_000);
  });

  it("falls back to the flow default for junk instead of zero", () => {
    for (const junk of [undefined, null, "", "abc", 0, -20, Number.NaN]) {
      expect(clampRobuxAmount(CONFIG, junk)).toBe(CONFIG.initialRobux);
    }
  });

  it("takes the first value when a query key repeats", () => {
    expect(clampRobuxAmount(CONFIG, ["800", "100"])).toBe(800);
  });

  it("carries the chosen nominal into the buy link", () => {
    expect(robuxOrderHref(CONFIG, 1700)).toBe(
      `${CONFIG.href}?${ROBUX_AMOUNT_PARAM}=1700`,
    );
    // No nominal asked for: a clean link, not a default stuffed into the URL.
    expect(robuxOrderHref(CONFIG)).toBe(CONFIG.href);
    // Out-of-range values never reach the link unclamped.
    expect(robuxOrderHref(CONFIG, 12)).toBe(`${CONFIG.href}?${ROBUX_AMOUNT_PARAM}=100`);
  });

  it("round-trips: a link's nominal comes back the same on the order page", () => {
    for (const amount of [100, 500, 800, 1700, 4500]) {
      const href = robuxOrderHref(CONFIG, amount);
      const params = new URLSearchParams(href.slice(href.indexOf("?")));
      expect(clampRobuxAmount(CONFIG, params.get(ROBUX_AMOUNT_PARAM))).toBe(amount);
    }
  });
});

describe("gamepassQuote", () => {
  it("cover bills the net figure and grosses the asset up", () => {
    const q = gamepassQuote("cover", 100);
    expect(q).toMatchObject({
      mode: "cover",
      input: 100,
      netRobux: 100,
      gamepassPrice: 143,
      billableRobux: 100,
      taxRobux: 43,
    });
  });

  it("no_cover bills the raw asset and eats the cut", () => {
    const q = gamepassQuote("no_cover", 143);
    expect(q).toMatchObject({
      mode: "no_cover",
      input: 143,
      netRobux: 100,
      gamepassPrice: 143,
      billableRobux: 143,
      taxRobux: 43,
    });
  });

  it("sanitizes hostile input to zero", () => {
    for (const input of [0, -5, Number.NaN]) {
      expect(gamepassQuote("cover", input).netRobux).toBe(0);
      expect(gamepassQuote("no_cover", input).netRobux).toBe(0);
    }
  });
});

describe("gamepass rates per tax mode", () => {
  it("picks the rate that matches who swallows the 30% cut", () => {
    const rates = { ...DEFAULT_ORDER_RATES, gamepassCover: 100, gamepassNoCover: 70 };
    expect(gamepassRate(rates, "cover")).toBe(100);
    expect(gamepassRate(rates, "no_cover")).toBe(70);
    expect(robuxOrderConfig("gamepass", rates, "cover").rate).toBe(100);
    expect(robuxOrderConfig("gamepass", rates, "no_cover").rate).toBe(70);
  });

  it("defaults to the cover rate for lobby quotes", () => {
    expect(robuxOrderConfig("gamepass").rate).toBe(DEFAULT_ORDER_RATES.gamepassCover);
  });

  it("keeps the other flows on their own single rate", () => {
    const rates = { ...DEFAULT_ORDER_RATES, username: 123 };
    expect(robuxOrderConfig("username", rates, "no_cover").rate).toBe(123);
  });

  it("ships a no-cover default 30% under the cover rate", () => {
    expect(DEFAULT_ORDER_RATES.gamepassNoCover).toBeCloseTo(
      DEFAULT_ORDER_RATES.gamepassCover * 0.7,
      2,
    );
  });

  it("prices the same net Robux the same under both default rates", () => {
    const cover = robuxOrderConfig("gamepass", DEFAULT_ORDER_RATES, "cover");
    const noCover = robuxOrderConfig("gamepass", DEFAULT_ORDER_RATES, "no_cover");
    const coverQuote = gamepassQuote("cover", 1_000);
    const noCoverQuote = gamepassQuote("no_cover", 1_429);
    expect(coverQuote.netRobux).toBe(noCoverQuote.netRobux);
    const coverPrice = robuxOrderPrice(cover, coverQuote.billableRobux);
    const noCoverPrice = robuxOrderPrice(noCover, noCoverQuote.billableRobux);
    expect(Math.abs(coverPrice - noCoverPrice)).toBeLessThan(100);
  });
});

describe("premiumSubtotal", () => {
  const rate = 185000;

  it("charges each plan at months × rate less its discount", () => {
    expect(premiumSubtotal(rate, 1)).toBe(185000);
    expect(premiumSubtotal(rate, 3)).toBe(Math.round(185000 * 3 * 0.85));
    expect(premiumSubtotal(rate, 12)).toBe(Math.round(185000 * 12 * (5 / 6)));
  });

  it("clamps out-of-range terms into 1..12", () => {
    expect(premiumSubtotal(rate, 0)).toBe(premiumSubtotal(rate, 1));
    expect(premiumSubtotal(rate, 99)).toBe(premiumSubtotal(rate, 12));
  });
});
