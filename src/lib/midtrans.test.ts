import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  verifyMidtransSignature,
  type MidtransNotificationPayload,
} from "@/lib/midtrans";

const SERVER_KEY = "SB-Mid-server-testkey123";

function sign(orderId: string, statusCode: string, gross: string, key = SERVER_KEY): string {
  return createHash("sha512").update(`${orderId}${statusCode}${gross}${key}`).digest("hex");
}

function payload(overrides: Partial<MidtransNotificationPayload> = {}): MidtransNotificationPayload {
  return {
    order_id: "BX-ABC123",
    status_code: "200",
    gross_amount: "150000.00",
    signature_key: sign("BX-ABC123", "200", "150000.00"),
    transaction_status: "settlement",
    ...overrides,
  };
}

describe("verifyMidtransSignature", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a correctly signed settlement", () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", SERVER_KEY);
    expect(verifyMidtransSignature(payload())).toBe(true);
  });

  it("rejects tampered amounts, statuses and keys", () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", SERVER_KEY);
    expect(verifyMidtransSignature(payload({ gross_amount: "150001.00" }))).toBe(false);
    // status_code IS covered by the signature (transaction_status is not —
    // Midtrans signs order_id + status_code + gross_amount + key only).
    expect(verifyMidtransSignature(payload({ status_code: "201" }))).toBe(false);
    expect(
      verifyMidtransSignature(payload({ signature_key: sign("BX-ABC123", "200", "150000.00", "other") })),
    ).toBe(false);
  });

  it("rejects malformed or missing signatures without throwing", () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", SERVER_KEY);
    expect(verifyMidtransSignature(payload({ signature_key: "" }))).toBe(false);
    expect(verifyMidtransSignature(payload({ signature_key: "zzzz" }))).toBe(false);
  });

  it("returns false when no server key is configured", () => {
    vi.stubEnv("MIDTRANS_SERVER_KEY", "");
    expect(verifyMidtransSignature(payload())).toBe(false);
  });
});
