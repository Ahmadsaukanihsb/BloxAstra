import type { OrderState } from "@/lib/types";

/**
 * Order-status presentation metadata (labels, buyer hints, tones).
 *
 * Extracted from the old mock layer so server and client components can share
 * one source of truth without importing fixtures.
 */
export const orderStates: Record<
  OrderState,
  {
    label: string;
    buyerHint: string;
    tone: "neutral" | "astra" | "robux" | "info" | "danger" | "warn";
  }
> = {
  pending_payment: {
    label: "Menunggu Pembayaran",
    buyerHint: "Selesaikan pembayaran dalam 15 menit sebelum tagihan kedaluwarsa.",
    tone: "warn",
  },
  paid: {
    label: "Dibayar · Dana Ditahan",
    buyerHint: "Dana ditahan sistem. Penjual diminta segera memulai. Pesanan yang terlalu lama tak tersentuh dikembalikan otomatis.",
    tone: "astra",
  },
  processing: {
    label: "Sedang Diproses",
    buyerHint: "Penjual sedang menyiapkan barang. Gunakan chat untuk koordinasi.",
    tone: "astra",
  },
  shipped: {
    label: "Barang Terkirim",
    buyerHint: "Periksa barang, lalu konfirmasi. Dana cair otomatis setelah masa tunggu.",
    tone: "robux",
  },
  completed: {
    label: "Selesai",
    buyerHint: "Dana sudah cair ke dompet penjual. Terima kasih sudah bertransaksi aman.",
    tone: "astra",
  },
  disputed: {
    label: "Sengketa",
    buyerHint: "Dana dibekukan. Admin akan memutuskan setelah kedua pihak mengirim bukti.",
    tone: "danger",
  },
  refunded: {
    label: "Dana Dikembalikan",
    buyerHint: "Seluruh dana kembali ke dompetmu. Kasus ditutup dengan catatan sengketa.",
    tone: "info",
  },
  cancelled: {
    label: "Dibatalkan",
    buyerHint: "Pesanan dibatalkan karena pembayaran gagal atau SLA penjual habis.",
    tone: "neutral",
  },
};

/**
 * Order states that still count as "in progress" on the buyer list.
 *
 * `open_pool` is intentionally absent: no code ever writes it (the pool lives
 * on `paid` + `sellerId: null`), so listing it here only promised a state that
 * cannot occur.
 */
export const ACTIVE_ORDER_STATES: OrderState[] = [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "disputed",
];

/** Money is parked in escrow for these states. */
export const ESCROW_ORDER_STATES: OrderState[] = ["paid", "processing", "shipped", "disputed"];

/** Money never reached the seller for these states. */
export const REFUNDED_ORDER_STATES: OrderState[] = ["cancelled", "refunded"];

/**
 * Dispute lifecycle vocabulary.
 *
 * A dispute is created as `open`, and the seller's first reply moves it to
 * `under_review`. Both mean "waiting for an admin decision" — the admin queue,
 * the arbitration action, the seller reply lock, and the buyer room all read
 * this one list. They used to restate the literals, which is how a replied
 * dispute ended up missing from the arbitration queue while its escrow stayed
 * frozen: the queue asked for `open`, and the panel's action refused anything
 * that was not `open`, so nobody could decide the case.
 */
export const DISPUTE_OPEN_STATE = "open";
export const DISPUTE_SELLER_REPLIED_STATE = "under_review";

/** Still awaiting a decision — the states an admin may act on. */
export const DECIDABLE_DISPUTE_STATES = [
  DISPUTE_OPEN_STATE,
  DISPUTE_SELLER_REPLIED_STATE,
] as const;

/** Decided by an admin; the case is closed and money has moved. */
export const RESOLVED_DISPUTE_STATES = ["resolved_refund", "resolved_release"] as const;

export function isDecidableDispute(status: string): boolean {
  return (DECIDABLE_DISPUTE_STATES as readonly string[]).includes(status);
}

/**
 * Delivery-speed threshold behind the "Kilat 10 Menit" badge and the express
 * filter. Single source so catalog, cards, and rows never drift apart.
 */
export const EXPRESS_SLA_SECONDS = 600;

/**
 * Per-tier daily sales ceiling (IDR). Single source for the seller dashboard
 * plafon card and the tier explanation shown during seller onboarding — the two
 * used to restate the Tier-1 figure by hand and could drift apart.
 */
export const TIER_DAILY_CAPS: Record<1 | 2 | 3, number> = {
  1: 500_000,
  2: 1_000_000,
  3: 2_500_000,
};
