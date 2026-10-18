import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  tripayChannelFor,
  tripayCreateSignature,
  tripayToMidtransStatus,
  verifyTripayCallback,
} from "@/lib/tripay";

const PRIVATE_KEY = "test-private-key-untuk-hmac";
const MERCHANT_CODE = "T0001";

describe("tripayChannelFor", () => {
  it("memetakan metode generik ke channel default", () => {
    vi.stubEnv("TRIPAY_QRIS_CHANNEL", "");
    vi.stubEnv("TRIPAY_VA_CHANNEL", "");
    vi.stubEnv("TRIPAY_EWALLET_CHANNEL", "");
    expect(tripayChannelFor("qris")).toBe("QRIS");
    expect(tripayChannelFor("va")).toBe("BRIVA");
    expect(tripayChannelFor("ewallet")).toBe("QRIS");
    vi.unstubAllEnvs();
  });

  it("menghormati override channel via env", () => {
    vi.stubEnv("TRIPAY_VA_CHANNEL", "BCAVA");
    expect(tripayChannelFor("va")).toBe("BCAVA");
    vi.unstubAllEnvs();
  });
});

describe("tripayCreateSignature", () => {
  it("HMAC-SHA256(merchantCode + merchantRef + amount, privateKey)", () => {
    vi.stubEnv("TRIPAY_PRIVATE_KEY", PRIVATE_KEY);
    vi.stubEnv("TRIPAY_MERCHANT_CODE", MERCHANT_CODE);
    const expected = createHmac("sha256", PRIVATE_KEY)
      .update(`${MERCHANT_CODE}BX-ABC123150000`)
      .digest("hex");
    expect(tripayCreateSignature("BX-ABC123", 150000)).toBe(expected);
    vi.unstubAllEnvs();
  });
});

describe("verifyTripayCallback", () => {
  it("menerima signature yang benar dan menolak yang salah", () => {
    vi.stubEnv("TRIPAY_PRIVATE_KEY", PRIVATE_KEY);
    const rawBody = JSON.stringify({ merchant_ref: "BX-ABC123", status: "PAID" });
    const good = createHmac("sha256", PRIVATE_KEY).update(rawBody).digest("hex");
    expect(verifyTripayCallback(rawBody, good)).toBe(true);
    expect(verifyTripayCallback(rawBody, "0".repeat(64))).toBe(false);
    expect(verifyTripayCallback(rawBody, null)).toBe(false);
    vi.unstubAllEnvs();
  });

  it("menolak ketika private key kosong", () => {
    vi.stubEnv("TRIPAY_PRIVATE_KEY", "");
    expect(verifyTripayCallback("{}", "a".repeat(64))).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("tripayToMidtransStatus", () => {
  it("memetakan status Tripay ke kosakata state machine", () => {
    expect(tripayToMidtransStatus("PAID")).toBe("settlement");
    expect(tripayToMidtransStatus("UNPAID")).toBe("pending");
    expect(tripayToMidtransStatus("EXPIRED")).toBe("expire");
    expect(tripayToMidtransStatus("FAILED")).toBe("failure");
    expect(tripayToMidtransStatus("CANCELLED")).toBe("failure");
    expect(tripayToMidtransStatus("REFUND")).toBe("refund");
    expect(tripayToMidtransStatus("paid")).toBe("settlement"); // case-insensitive
    expect(tripayToMidtransStatus("ANEH")).toMatch(/^unknown:/);
  });
});
