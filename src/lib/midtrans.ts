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

/** True whenever orders must be settled locally instead of via Midtrans. */
export function isSimMode(): boolean {
  return process.env.PAYMENT_PROVIDER !== "midtrans";
}

export interface SnapTransactionInput {
  /** our order code — becomes Midtrans order_id and the webhook lookup key */
  orderId: string;
  grossAmount: number;
  itemName: string;
  customerName: string;
  customerEmail: string;
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
      // their own order room — never on a generic list page.
      expiry: { unit: "minutes", duration: 15 },
      callbacks: {
        finish: absoluteUrl(`/pesanan/${input.orderId}`),
        unfinish: absoluteUrl(`/pesanan/${input.orderId}`),
        error: absoluteUrl(`/pesanan/${input.orderId}`),
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
  if (!response.ok) {
    throw new Error(`Midtrans status ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    transaction_status?: string;
    fraud_status?: string;
    gross_amount?: string;
  };
  const grossAmount = Number(data.gross_amount);
  if (!data.transaction_status || !Number.isFinite(grossAmount)) {
    throw new Error("Respons status Midtrans tidak valid.");
  }
  return {
    transactionStatus: data.transaction_status,
    fraudStatus: data.fraud_status,
    grossAmount,
  };
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
