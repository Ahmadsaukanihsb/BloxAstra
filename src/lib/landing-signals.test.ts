import { describe, expect, it } from "vitest";
import { landingSignalLabels } from "@/lib/landing-signals";

describe("landingSignalLabels", () => {
  it("prints nothing at all for a marketplace with no history", () => {
    expect(landingSignalLabels({ completedOrders: 0, verifiedSellers: 0 })).toEqual([]);
  });

  it("drops only the counts that are still zero", () => {
    expect(landingSignalLabels({ completedOrders: 12, verifiedSellers: 0 })).toEqual([
      "12 order selesai",
    ]);
    expect(landingSignalLabels({ completedOrders: 0, verifiedSellers: 3 })).toEqual([
      "3 penjual terverifikasi KYC",
    ]);
  });

  it("groups large counts in Indonesian thousands", () => {
    expect(landingSignalLabels({ completedOrders: 1_240, verifiedSellers: 26 })).toEqual([
      "1.240 order selesai",
      "26 penjual terverifikasi KYC",
    ]);
  });
});
