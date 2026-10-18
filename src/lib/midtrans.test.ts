import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyMidtransStatus,
  retiredTopUpStatus,
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

describe("classifyMidtransStatus", () => {
  it("treats settlement and clean capture as settled", () => {
    expect(classifyMidtransStatus("settlement", "accept")).toBe("settled");
    expect(classifyMidtransStatus("capture", "accept")).toBe("settled");
    expect(classifyMidtransStatus("capture")).toBe("settled");
  });

  it("holds a `capture` still under fraud review (challenge)", () => {
    // Crediting a challenged capture pays out money that may later be denied,
    // with no clawback path — it must stay unpaid.
    expect(classifyMidtransStatus("capture", "challenge")).toBe("unpaid");
  });

  it("never retires the invoice on the first `pending` notification", () => {
    // Regression: retiring here killed invoices that Midtrans settled a
    // minute later, so the buyer paid and the wallet was never credited.
    expect(classifyMidtransStatus("pending")).toBe("unpaid");
    expect(classifyMidtransStatus("pending", "accept")).toBe("unpaid");
  });

  it("retires only terminal statuses and fraud denials", () => {
    for (const status of ["deny", "cancel", "expire", "failure"]) {
      expect(classifyMidtransStatus(status)).toBe("retired");
    }
    expect(classifyMidtransStatus("capture", "deny")).toBe("retired");
  });

  it("retires refunded payments instead of leaving them unpaid", () => {
    // A refund/partial_refund means the money moved back — the invoice is
    // done, not still payable (top-up settlement relies on this).
    expect(classifyMidtransStatus("refund")).toBe("retired");
    expect(classifyMidtransStatus("partial_refund")).toBe("retired");
    expect(classifyMidtransStatus("something_new")).toBe("unpaid");
  });

  it("parks a retired invoice in the matching local status", () => {
    expect(retiredTopUpStatus("expire")).toBe("expired");
    expect(retiredTopUpStatus("cancel")).toBe("failed");
    expect(retiredTopUpStatus("deny")).toBe("failed");
  });
});
