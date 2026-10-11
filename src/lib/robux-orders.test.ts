import { describe, expect, it } from "vitest";
import {
  gamepassQuote,
  premiumSubtotal,
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
