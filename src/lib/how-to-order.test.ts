import { describe, expect, it } from "vitest";
import { howToOrder, howToOrderSteps, type HowToOrderWindows } from "@/lib/how-to-order";

/**
 * The band exists to answer doubts before payment, so the one thing worth
 * locking down is that it never states a window the sweep job does not enforce.
 * These tests drive the copy with two different sets of windows: if a number
 * were typed into the copy instead of interpolated, the second case could not
 * change it.
 */
const WINDOWS: HowToOrderWindows = {
  poolHours: 24,
  assignedHours: 72,
  processingDays: 7,
  disputeSlaHours: 24,
  credentialWipeDays: 7,
};

describe("howToOrder", () => {
  it("keeps the three steps in order", () => {
    const steps = howToOrderSteps();
    expect(steps.map((step) => step.no)).toEqual(["01", "02", "03"]);
    expect(steps.map((step) => step.title)).toEqual([
      "Pilih metode dan nominalnya",
      "Bayar, dan uang berhenti di platform",
      "Barang masuk, baru dana dilepas",
    ]);
    // Every step carries the one detail pulled out of its body.
    expect(steps.every((step) => step.fact.length > 10)).toBe(true);
  });

  it("quotes the windows the sweep actually enforces", () => {
    const [, credentials, dispute] = howToOrder(WINDOWS).doubts;
    expect(credentials.a).toContain("7 hari setelah pesanan selesai");
    expect(dispute.a).toContain("24 jam");
  });

  it("follows the windows instead of hardcoding them", () => {
    const retuned = howToOrder({
      ...WINDOWS,
      assignedHours: 48,
      processingDays: 3,
      poolHours: 12,
      disputeSlaHours: 36,
      credentialWipeDays: 2,
    });

    const [refund] = retuned.doubts;
    expect(refund.a).toContain("48 jam");
    expect(refund.a).toContain("3 hari");
    expect(refund.a).toContain("12 jam");
    expect(refund.a).not.toContain("72 jam");
    expect(retuned.doubts[1].a).toContain("2 hari");
    expect(retuned.doubts[2].a).toContain("36 jam");
  });

  it("never prints a broken number or a leaked placeholder", () => {
    const copy = howToOrder(WINDOWS);
    const text = [...copy.steps.flatMap(Object.values), ...copy.doubts.flatMap(Object.values)];
    for (const line of text) {
      expect(line).not.toMatch(/undefined|NaN|\$\{|\d+undefined/);
    }
  });

  it("asks each doubt as a question and answers it", () => {
    for (const doubt of howToOrder(WINDOWS).doubts) {
      expect(doubt.q.endsWith("?")).toBe(true);
      // Long enough to name a mechanism rather than offer a reassurance.
      expect(doubt.a.length).toBeGreaterThan(80);
    }
  });
});
