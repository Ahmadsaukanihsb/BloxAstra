import {
  ACTIVE_ORDER_STATES,
  ESCROW_ORDER_STATES,
  REFUNDED_ORDER_STATES,
} from "@/lib/order-meta";

/**
 * The vocabulary and the arithmetic behind the admin search page, kept pure so
 * it can be tested without a database or a session.
 *
 * Two rules this module exists to enforce:
 *
 *   1. Every operational queue states a total and a page, so a list that only
 *      holds the first N rows can never pass itself off as the whole queue.
 *   2. A link carries the query and the filters that produced it. A pager that
 *      silently drops `q` on page 2 sends the admin somewhere they did not ask
 *      to be, so `searchHref` writes every parameter back out.
 *
 * The order scopes re-use the state groups from `order-meta.ts` rather than
 * restating the string literals — the same lists the escrow and refund logic
 * run on, so a new state cannot end up in one place and not the other.
 */

/** Rows per page once a single kind is selected. */
export const ADMIN_PAGE_SIZE = 20;
/** Rows per section while the "everything" tab previews all kinds at once. */
export const ADMIN_PREVIEW_SIZE = 5;

export type AdminKind = "semua" | "pesanan" | "pengguna" | "penarikan" | "audit";
export type OrderScope = "semua" | "aktif" | "escrow" | "sengketa" | "selesai" | "batal";
export type UserScope = "semua" | "penjual" | "pembeli" | "admin";
export type KycScope = "semua" | "pending" | "verified" | "rejected" | "none";
export type WdScope = "semua" | "pending" | "paid" | "rejected";

export const ADMIN_KINDS: { id: AdminKind; label: string; hint: string }[] = [
  { id: "semua", label: "Semua", hint: "Cuplikan dari tiap jenis" },
  { id: "pesanan", label: "Pesanan", hint: "Kode, pembeli, penjual, atau produk" },
  { id: "pengguna", label: "Pengguna", hint: "Username, email, atau WhatsApp" },
  { id: "penarikan", label: "Penarikan", hint: "Ref, bank, atau nomor rekening" },
  { id: "audit", label: "Jejak audit", hint: "Aksi, aktor, atau resource" },
];

/**
 * Order scopes. `states` null means "no status filter" — deliberately distinct
 * from an empty array, which would match nothing.
 */
export const ORDER_SCOPES: { id: OrderScope; label: string; states: string[] | null }[] = [
  { id: "semua", label: "Semua status", states: null },
  { id: "aktif", label: "Sedang berjalan", states: ACTIVE_ORDER_STATES },
  { id: "escrow", label: "Dana ditahan", states: ESCROW_ORDER_STATES },
  { id: "sengketa", label: "Sengketa", states: ["disputed"] },
  { id: "selesai", label: "Selesai", states: ["completed"] },
  { id: "batal", label: "Batal & refund", states: REFUNDED_ORDER_STATES },
];

export const USER_SCOPES: { id: UserScope; label: string; role: string | null }[] = [
  { id: "semua", label: "Semua peran", role: null },
  { id: "penjual", label: "Penjual", role: "seller" },
  { id: "pembeli", label: "Pembeli", role: "buyer" },
  { id: "admin", label: "Admin", role: "admin" },
];

export const KYC_SCOPES: { id: KycScope; label: string; value: string | null }[] = [
  { id: "semua", label: "Semua KYC", value: null },
  { id: "pending", label: "Menunggu", value: "pending" },
  { id: "verified", label: "Terverifikasi", value: "verified" },
  { id: "rejected", label: "Ditolak", value: "rejected" },
  { id: "none", label: "Belum ada", value: "none" },
];

export const WD_SCOPES: { id: WdScope; label: string; value: string | null }[] = [
  { id: "semua", label: "Semua status", value: null },
  { id: "pending", label: "Menunggu", value: "pending" },
  { id: "paid", label: "Sudah cair", value: "paid" },
  { id: "rejected", label: "Ditolak", value: "rejected" },
];

/** Longest query the page will honour — a search box is not an input field for essays. */
export const ADMIN_QUERY_MAX = 60;

/** `searchParams` values arrive as string | string[]; take the first. */
export function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Trim, collapse runs of whitespace, and cap the length. */
export function cleanQuery(raw: string | string[] | undefined): string {
  return first(raw).replace(/\s+/g, " ").trim().slice(0, ADMIN_QUERY_MAX);
}

function pick<T extends string>(options: readonly { id: T }[], raw: unknown, fallback: T): T {
  const value = first(raw as string | string[] | undefined);
  return options.some((option) => option.id === value) ? (value as T) : fallback;
}

export function parseKind(raw: unknown): AdminKind {
  return pick(ADMIN_KINDS, raw, "semua");
}

export function parseOrderScope(raw: unknown): OrderScope {
  return pick(ORDER_SCOPES, raw, "semua");
}

export function parseUserScope(raw: unknown): UserScope {
  return pick(USER_SCOPES, raw, "semua");
}

export function parseKycScope(raw: unknown): KycScope {
  return pick(KYC_SCOPES, raw, "semua");
}

export function parseWdScope(raw: unknown): WdScope {
  return pick(WD_SCOPES, raw, "semua");
}

export function parseSearchPage(raw: unknown): number {
  const value = Number(first(raw as string | string[] | undefined));
  return Number.isInteger(value) && value > 0 ? value : 1;
}

export interface Pager {
  /** the page actually shown, clamped into range */
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  /** 1-based index of the first row on this page; 0 when there are no rows */
  from: number;
  /** 1-based index of the last row on this page; 0 when there are no rows */
  to: number;
  /** Prisma `skip` value */
  offset: number;
  hasPrev: boolean;
  hasNext: boolean;
}

/**
 * Clamp a requested page against the real total. A page past the end returns the
 * last page instead of an empty list: a stale link or a filter change that
 * shrank the result set should not look like "no records".
 */
export function pager(total: number, page: number, perPage: number): Pager {
  const safePerPage = Math.max(1, Math.floor(perPage));
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const pageCount = Math.max(1, Math.ceil(safeTotal / safePerPage));
  const requested = Math.floor(Number.isFinite(page) ? page : 1) || 1;
  const safePage = Math.min(Math.max(1, requested), pageCount);
  const offset = (safePage - 1) * safePerPage;
  return {
    page: safePage,
    pageCount,
    total: safeTotal,
    perPage: safePerPage,
    from: safeTotal === 0 ? 0 : offset + 1,
    to: Math.min(offset + safePerPage, safeTotal),
    offset,
    hasPrev: safePage > 1,
    hasNext: safePage < pageCount,
  };
}

export interface SearchQuery {
  q: string;
  kind: AdminKind;
  orderScope: OrderScope;
  userScope: UserScope;
  kycScope: KycScope;
  wdScope: WdScope;
  page: number;
}

/** Defaults are omitted so a plain search stays a plain URL. */
export function searchHref(query: Partial<SearchQuery>): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.kind && query.kind !== "semua") params.set("jenis", query.kind);
  if (query.orderScope && query.orderScope !== "semua") params.set("status", query.orderScope);
  if (query.userScope && query.userScope !== "semua") params.set("peran", query.userScope);
  if (query.kycScope && query.kycScope !== "semua") params.set("kyc", query.kycScope);
  if (query.wdScope && query.wdScope !== "semua") params.set("penarikan", query.wdScope);
  if (query.page && query.page > 1) params.set("hal", String(query.page));
  const search = params.toString();
  return search ? `/admin/cari?${search}` : "/admin/cari";
}

/** "Menampilkan 21–40 dari 137" — the honest label every truncated list needs. */
export function rangeLabel(current: Pager): string {
  if (current.total === 0) return "Tidak ada baris";
  return `Menampilkan ${current.from}–${current.to} dari ${current.total}`;
}
