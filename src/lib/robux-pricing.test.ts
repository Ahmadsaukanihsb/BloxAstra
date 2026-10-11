import { describe, expect, it } from "vitest";
import {
  DEFAULT_RATE_CARD,
  listingInput,
  listingQuote,
  productPrice,
  quoteRobux,
  repriceCatalog,
  type RateCard,
} from "@/lib/robux-pricing";

const CARD: RateCard = DEFAULT_RATE_CARD;

describe("quoteRobux cover", () => {
  it("prices 100 net Robux with no volume tier", () => {
    const q = quoteRobux("cover", 100, CARD);
    expect(q.netRobux).toBe(100);
    expect(q.gamepassPrice).toBe(143); // ceil(100 / 0.7)
    expect(q.totalIdr).toBe(14500); // 100 × 145, already a 500 multiple
    expect(q.perRobux).toBe(145);
    expect(q.taxRobux).toBe(43);
    expect(q.savingsIdr).toBe(0);
  });

  it("applies the 2000-unit volume tier and rounds up to Rp500", () => {
    const q = quoteRobux("cover", 2000, CARD);
    // 2000 × 145 = 290000 × 0.98 = 284200 → ceil to 284500
    expect(q.totalIdr).toBe(284500);
    expect(q.savingsIdr).toBe(290000 - 284500);
  });

  it("applies the 10000-unit volume tier", () => {
    const q = quoteRobux("cover", 10000, CARD);
    // 10000 × 145 = 1450000 × 0.94 = 1363000 (exact multiple)
    expect(q.totalIdr).toBe(1363000);
  });

  it("treats zero, negative and NaN input as a zero quote, never negative", () => {
    for (const input of [0, -50, Number.NaN]) {
      const q = quoteRobux("cover", input, CARD);
      expect(q.totalIdr).toBe(0);
      expect(q.netRobux).toBe(0);
      expect(q.perRobux).toBe(0);
    }
  });
});

describe("quoteRobux no_cover", () => {
  it("bills the raw gamepass figure and delivers the floored net", () => {
    const q = quoteRobux("no_cover", 143, CARD);
    expect(q.gamepassPrice).toBe(143);
    expect(q.netRobux).toBe(100); // floor(143 × 0.7)
    expect(q.taxRobux).toBe(43);
    // 100 × 128 = 12800 → ceil to 13000
    expect(q.totalIdr).toBe(13000);
  });
});

describe("listingQuote", () => {
  it("multiplies cover input by quantity before quoting", () => {
    // 1000 × 2 = 2000 net → same as the 2000-unit quote above
    expect(listingQuote(1000, "cover", 2, CARD).totalIdr).toBe(284500);
  });

  it("quotes the raw gamepass price for no_cover listings", () => {
    const q = listingQuote(1000, "no_cover", 1, CARD);
    expect(q.gamepassPrice).toBe(1429); // ceil(1000 / 0.7)
    expect(q.netRobux).toBeGreaterThanOrEqual(1000);
  });

  it("clamps quantity below 1 up to a single unit", () => {
    expect(listingQuote(500, "cover", 0, CARD).totalIdr).toBe(
      listingQuote(500, "cover", 1, CARD).totalIdr,
    );
  });

  it("exposes the buyer-facing input per mode", () => {
    expect(listingInput(1000, "cover")).toBe(1000);
    expect(listingInput(1000, "no_cover")).toBe(1429);
  });
});

describe("productPrice / repriceCatalog", () => {
  it("keeps fixed prices untouched", () => {
    expect(productPrice({ price: 50000 }, CARD)).toBe(50000);
  });

  it("re-quotes robux packages through the rate card", () => {
    expect(
      productPrice({ price: 0, netRobux: 100, pricingMode: "cover" }, CARD),
    ).toBe(14500);
  });

  it("re-prices a whole catalog while preserving other fields", () => {
    const items = [
      { id: "a", price: 10000 },
      { id: "b", price: 0, netRobux: 100, pricingMode: "cover" as const },
    ];
    const out = repriceCatalog(items, CARD);
    expect(out[0].price).toBe(10000);
    expect(out[1].price).toBe(14500);
    expect(out[1].id).toBe("b");
  });
});
