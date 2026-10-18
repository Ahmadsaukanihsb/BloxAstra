import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { absoluteUrl } from "@/lib/site";

/**
 * Midtrans Snap integration.
 *
 * Live mode (PAYMENT_PROVIDER="midtrans"): every order is charged through the
 * hosted Snap page; Midtrans calls our webhook with a SHA-512 signature over
 * `order_id + status_code + gross_amount + server_key`.
 *
 * Sim mode (PAYMENT_PROVIDER="sim"): no external calls — the "checkout URL"
 * points at our local /bayar/sim page which settles through the same
 * notification state machine the webhook uses.
 */

const SNAP_BASE_URLS = {
  sandbox: "https://app.sandbox.midtrans.com",
  production: "https://app.midtrans.com",
} as const;

const isProd = process.env.NODE_ENV === "production";

export function midtransServerKey(): string {
  const key = process.env.MIDTRANS_SERVER_KEY ?? "";
  if (isProd && !isSimMode() && !key) {
    throw new Error("MIDTRANS_SERVER_KEY is not set — required in production midtrans mode.");
  }
  return key;
}

export function midtransClientKey(): string {
  const key = process.env.MIDTRANS_CLIENT_KEY ?? "";
  if (isProd && !isSimMode() && !key) {
    throw new Error("MIDTRANS_CLIENT_KEY is not set — required in production midtrans mode.");
  }
  return key;
}

function snapBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? SNAP_BASE_URLS.production
    : SNAP_BASE_URLS.sandbox;
}

/**
 * True whenever orders must be settled locally instead of via a gateway.
 * Any provider that is neither Midtrans (legacy) nor Tripay falls back to
 * sim — including an unset PAYMENT_PROVIDER in development.
 */
export function isSimMode(): boolean {
  const provider = process.env.PAYMENT_PROVIDER;
  return provider !== "midtrans" && provider !== "tripay";
}

export interface SnapTransactionInput {
  /** our order code — becomes Midtrans order_id and the webhook lookup key */
  orderId: string;
  grossAmount: number;
  itemName: string;
  customerName: string;
  customerEmail: string;
  /**
   * Where Snap sends the buyer back. Defaults to the order room; wallet
   * top-ups pass /dompet because there is no order room for a TU- code.
   */
  returnPath?: string;
}

export interface SnapTransactionResult {
  redirectUrl: string;
  token: string;
}

/** Only validated customer fields — Midtrans 400s on malformed ones. */
function buildCustomerDetails(name: string, email: string): Record<string, string> {
  const details: Record<string, string> = {};
  const cleanName = name.trim().slice(0, 50);
  if (cleanName) details.first_name = cleanName;
  const cleanEmail = email.trim().slice(0, 100);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) details.email = cleanEmail;
  return details;
}

/** Create a Snap transaction (or its sim-mode stand-in) for a pending order. */
export async function createSnapTransaction(
  input: SnapTransactionInput,
): Promise<SnapTransactionResult> {
  if (isSimMode()) {
    return {
      redirectUrl: absoluteUrl(`/bayar/sim?order=${encodeURIComponent(input.orderId)}`),
      token: `sim-${input.orderId}`,
    };
  }

  const serverKey = midtransServerKey();
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum diisi tetapi PAYMENT_PROVIDER=midtrans");
  }

  const response = await fetch(`${snapBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.grossAmount,
      },
      item_details: [
        {
          id: input.orderId,
          price: input.grossAmount,
          quantity: 1,
          name: input.itemName.slice(0, 50),
        },
      ],
      // Midtrans 400-rejects malformed fields, so only send fields that
      // actually validate (OAuth users often have no email on file).
      customer_details: buildCustomerDetails(input.customerName, input.customerEmail),
      // After paying (or abandoning) Snap, the buyer always lands back in
      // the surface that can still act on this invoice — never on a 404.
      expiry: { unit: "minutes", duration: 15 },
      callbacks: {
        finish: absoluteUrl(input.returnPath ?? `/pesanan/${input.orderId}`),
        unfinish: absoluteUrl(input.returnPath ?? `/pesanan/${input.orderId}`),
        error: absoluteUrl(input.returnPath ?? `/pesanan/${input.orderId}`),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Midtrans Snap ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { token: string; redirect_url: string };
  return { redirectUrl: data.redirect_url, token: data.token };
}

export interface MidtransStatusResult {
  transactionStatus: string;
  fraudStatus?: string;
  grossAmount: number;
}

/**
 * Midtrans has no record of this order_id — the buyer never opened the Snap
 * page, so nothing was ever charged. Distinguished from transport failures so
 * callers do not tell a buyer "coba lagi" for an invoice that does not exist.
 */
export class MidtransNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Midtrans tidak mengenal transaksi ${orderId}.`);
    this.name = "MidtransNotFoundError";
  }
}

function statusBaseUrl(): string {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://api.midtrans.com"
    : "https://api.sandbox.midtrans.com";
}

/**
 * Query the Midtrans Status API for one order. Used by the buyer-triggered
 * "saya sudah bayar" reconcile when the webhook never arrived — the result
 * is funneled through the same state machine as webhooks.
 */
export async function fetchMidtransStatus(orderId: string): Promise<MidtransStatusResult> {
  const serverKey = midtransServerKey();
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum diisi");
  }
  const response = await fetch(`${statusBaseUrl()}/v2/${encodeURIComponent(orderId)}/status`, {
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
    },
  });
  if (response.status === 404) {
    throw new MidtransNotFoundError(orderId);
  }
  if (!response.ok) {
    throw new Error(`Midtrans status ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    transaction_status?: string;
    fraud_status?: string;
    gross_amount?: string;
    status_code?: string;
  };
  // Midtrans sometimes answers 200 with a body-only 404 for unknown ids.
  if (data.status_code === "404" || !data.transaction_status) {
    throw new MidtransNotFoundError(orderId);
  }
  const grossAmount = Number(data.gross_amount);
  if (!Number.isFinite(grossAmount)) {
    throw new Error("Respons status Midtrans tidak valid.");
  }
  return {
    transactionStatus: data.transaction_status,
    fraudStatus: data.fraud_status,
    grossAmount,
  };
}

/**
 * What one gateway status means for whoever owns the money.
 *
 * `unpaid` is the trap this exists to prevent: `pending` is Midtrans' first
 * notification (the VA/QRIS charge was just issued) and is NOT a failure —
 * retiring the invoice there loses a settlement that arrives a minute later.
 */
export type MidtransVerdict = "settled" | "unpaid" | "retired";

const RETIRING_STATUSES = ["deny", "cancel", "expire", "failure", "refund", "partial_refund"];

export function classifyMidtransStatus(status: string, fraudStatus?: string): MidtransVerdict {
  // `settlement` means the money already moved — always settled.
  if (status === "settlement" && fraudStatus !== "deny") return "settled";
  // `capture` is a card authorization still under fraud review: only `accept`
  // (or no verdict) is money. `challenge` is held, not credited — otherwise a
  // challenged capture is paid out and a later deny has no clawback path.
  if (status === "capture" && (fraudStatus === undefined || fraudStatus === "accept")) {
    return "settled";
  }
  if (fraudStatus === "deny" || RETIRING_STATUSES.includes(status)) return "retired";
  return "unpaid";
}

/** Local DB status to park a retired invoice in. */
export function retiredTopUpStatus(status: string): "failed" | "expired" {
  return status === "expire" ? "expired" : "failed";
}

export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  [key: string]: unknown;
}

/**
 * Verify the Midtrans webhook signature:
 * SHA-512(order_id + status_code + gross_amount + server_key), compared
 * timing-safe against `signature_key`.
 */
export function verifyMidtransSignature(payload: MidtransNotificationPayload): boolean {
  const serverKey = midtransServerKey();
  if (!serverKey || !payload.signature_key) return false;

  const expected = createHash("sha512")
    .update(`${payload.order_id}${payload.status_code}${payload.gross_amount}${serverKey}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(payload.signature_key, "hex");
  return expectedBuf.length === providedBuf.length && timingSafeEqual(expectedBuf, providedBuf);
}
