import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { absoluteUrl } from "@/lib/site";
import type { PaymentMethodId } from "@/lib/payments";

/**
 * Tripay closed-payment integration (replaces Midtrans Snap).
 *
 * Live mode (PAYMENT_PROVIDER="tripay"): every invoice is created through
 * Tripay's transaction API on ONE explicit channel per our checkout method
 * (Tripay requires `method`), the buyer pays on Tripay's hosted checkout
 * page, and Tripay calls our webhook with an HMAC-SHA256 signature over the
 * raw JSON body.
 *
 * Sim mode (PAYMENT_PROVIDER="sim"): unchanged — local /bayar/sim settlement.
 * Midtrans code paths are kept only for invoices created before the switch.
 *
 * Money note: Tripay settles `amount_received` (our amount minus THEIR
 * merchant fee) to the merchant balance. Our buyer-facing totals and platform
 * fees are unchanged — Tripay's cut comes out of settlement, reconciled in
 * the Tripay dashboard, not in this ledger.
 */

const isProd = process.env.NODE_ENV === "production";

export function tripayApiKey(): string {
  const key = process.env.TRIPAY_API_KEY ?? "";
  if (isProd && isTripayMode() && !key) {
    throw new Error("TRIPAY_API_KEY is not set — required in production tripay mode.");
  }
  return key;
}

export function tripayPrivateKey(): string {
  const key = process.env.TRIPAY_PRIVATE_KEY ?? "";
  if (isProd && isTripayMode() && !key) {
    throw new Error("TRIPAY_PRIVATE_KEY is not set — required in production tripay mode.");
  }
  return key;
}

export function tripayMerchantCode(): string {
  const code = process.env.TRIPAY_MERCHANT_CODE ?? "";
  if (isProd && isTripayMode() && !code) {
    throw new Error("TRIPAY_MERCHANT_CODE is not set — required in production tripay mode.");
  }
  return code;
}

function tripayBaseUrl(): string {
  return process.env.TRIPAY_IS_PRODUCTION === "true"
    ? "https://tripay.co.id/api"
    : "https://tripay.co.id/api-sandbox";
}

/** True when invoices must go through Tripay instead of Midtrans/sim. */
export function isTripayMode(): boolean {
  return process.env.PAYMENT_PROVIDER === "tripay";
}

/**
 * Our generic checkout method → one concrete Tripay channel. Tripay demands
 * a specific channel per transaction, so each mapping is env-overridable
 * (the code must be active on the merchant's Tripay account).
 */
export function tripayChannelFor(method: PaymentMethodId): string {
  // `||` (not `??`) so an empty env value still falls back to the default.
  if (method === "qris") return process.env.TRIPAY_QRIS_CHANNEL || "QRIS";
  if (method === "ewallet") return process.env.TRIPAY_EWALLET_CHANNEL || "QRIS";
  if (method === "va") return process.env.TRIPAY_VA_CHANNEL || "BRIVA";
  return process.env.TRIPAY_QRIS_CHANNEL || "QRIS"; // saldo never reaches here
}

export interface TripayTransactionInput {
  /** our order/top-up code — becomes Tripay merchant_ref and the lookup key */
  orderId: string;
  grossAmount: number;
  itemName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  paymentMethod: PaymentMethodId;
  /**
   * Where Tripay sends the buyer back. Defaults to the order room; wallet
   * top-ups pass /dompet because there is no order room for a TU- code.
   */
  returnPath?: string;
  /** seconds the invoice stays payable (default 15 minutes, like before) */
  expirySeconds?: number;
}

export interface TripayTransactionResult {
  redirectUrl: string;
  /** Tripay `reference` — stored as providerOrderId for status lookups */
  reference: string;
}

/** HMAC-SHA256(merchantCode + merchantRef + amount) sealed with the private key. */
export function tripayCreateSignature(merchantRef: string, amount: number): string {
  return createHmac("sha256", tripayPrivateKey())
    .update(`${tripayMerchantCode()}${merchantRef}${amount}`)
    .digest("hex");
}

/** Create a Tripay transaction and hand back its hosted checkout URL. */
export async function createTripayTransaction(
  input: TripayTransactionInput,
): Promise<TripayTransactionResult> {
  const apiKey = tripayApiKey();
  if (!apiKey) {
    throw new Error("TRIPAY_API_KEY belum diisi tetapi PAYMENT_PROVIDER=tripay");
  }

  const method = tripayChannelFor(input.paymentMethod);
  const expiredTime = Math.floor(Date.now() / 1000) + (input.expirySeconds ?? 15 * 60);
  const signature = tripayCreateSignature(input.orderId, input.grossAmount);

  const body: Record<string, unknown> = {
    method,
    merchant_ref: input.orderId,
    amount: input.grossAmount,
    customer_name: input.customerName.trim().slice(0, 100) || "Pembeli",
    customer_email:
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.customerEmail.trim().slice(0, 100))
        ? input.customerEmail.trim().slice(0, 100)
        : "noreply@bloxastra.com",
    order_items: [
      {
        sku: input.orderId,
        name: input.itemName.slice(0, 50),
        price: input.grossAmount,
        quantity: 1,
      },
    ],
    callback_url: absoluteUrl("/api/payments/tripay"),
    return_url: absoluteUrl(input.returnPath ?? `/pesanan/${input.orderId}`),
    expired_time: expiredTime,
    signature,
  };
  // Some channels (e-wallets) require the buyer phone — only send it when we
  // actually have one; Tripay 400s on malformed numbers.
  const phone = (input.customerPhone ?? "").replace(/\D/g, "");
  if (phone.length >= 9 && phone.length <= 15) body.customer_phone = phone;

  const response = await fetch(`${tripayBaseUrl()}/transaction/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Tripay create ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    success?: boolean;
    message?: string;
    data?: { checkout_url?: string; reference?: string };
  };
  const redirectUrl = data.data?.checkout_url;
  const reference = data.data?.reference;
  if (!data.success || !redirectUrl || !reference) {
    throw new Error(`Tripay create ditolak: ${data.message || "respons tidak valid"}`);
  }
  return { redirectUrl, reference };
}

export interface TripayCallbackPayload {
  reference: string;
  merchant_ref: string;
  payment_method?: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Verify a Tripay webhook: HMAC-SHA256(raw JSON body, privateKey) compared
 * timing-safe against the `X-Callback-Signature` header.
 */
export function verifyTripayCallback(rawBody: string, signatureHeader: string | null): boolean {
  const privateKey = tripayPrivateKey();
  if (!privateKey || !signatureHeader) return false;
  const expected = createHmac("sha256", privateKey).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface TripayStatusResult {
  /** one of UNPAID | PAID | EXPIRED | FAILED | REFUND(+variants) */
  status: string;
  merchantRef: string;
  amount: number;
}

/**
 * Tripay has no record of this reference — the buyer never opened the
 * checkout page, so nothing was ever charged.
 */
export class TripayNotFoundError extends Error {
  constructor(reference: string) {
    super(`Tripay tidak mengenal transaksi ${reference}.`);
    this.name = "TripayNotFoundError";
  }
}

/** Query the Tripay detail API for one reference (buyer reconcile + webhook authority). */
export async function fetchTripayDetail(reference: string): Promise<TripayStatusResult> {
  const apiKey = tripayApiKey();
  if (!apiKey) {
    throw new Error("TRIPAY_API_KEY belum diisi");
  }
  const url = `${tripayBaseUrl()}/transaction/detail?${new URLSearchParams({ reference }).toString()}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
  });
  if (response.status === 404) {
    throw new TripayNotFoundError(reference);
  }
  if (!response.ok) {
    throw new Error(`Tripay detail ${response.status}: ${await response.text()}`);
  }
  const data = (await response.json()) as {
    success?: boolean;
    data?: { reference?: string; merchant_ref?: string; status?: string; amount?: number | string };
  };
  const detail = data.data;
  if (!data.success || !detail?.status || !detail.merchant_ref) {
    throw new TripayNotFoundError(reference);
  }
  const amount = Number(detail.amount);
  if (!Number.isFinite(amount)) {
    throw new Error("Respons detail Tripay tidak valid.");
  }
  return { status: detail.status, merchantRef: detail.merchant_ref, amount };
}

/**
 * Translate a Tripay status into the Midtrans vocabulary our shared payment
 * state machine already speaks, so webhooks and reconciles funnel through
 * `classifyMidtransStatus` unchanged.
 */
export function tripayToMidtransStatus(status: string): string {
  switch (status.toUpperCase()) {
    case "PAID":
      return "settlement";
    case "UNPAID":
      return "pending";
    case "EXPIRED":
      return "expire";
    case "FAILED":
    case "CANCELLED":
    case "CANCEL":
      return "failure";
    case "REFUND":
    case "REFUNDED":
    case "REFUND_PROCESS":
      return "refund";
    default:
      return `unknown:${status}`;
  }
}
