/** Roblox marketplace tax: a gamepass sale returns 70% of the listed price. */
export const ROBLOX_TAX_RATE = 0.7;

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

/** Rp 145.000 */
export function formatIDR(value: number): string {
  return idr.format(Math.round(value)).replace(/\s/g, " ");
}

/** 145rb / 1,4jt — for dense stat rows */
export function formatIDRCompact(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${sign}Rp ${String(rounded).replace(".", ",")}jt`;
  }

  if (abs >= 1_000) {
    const thousands = Math.round(abs / 1_000);
    // 999.500 rounds to 1000rb — promote it instead of printing "Rp 1000rb".
    if (thousands >= 1000) return `${sign}Rp ${thousands / 1000}jt`;
    return `${sign}Rp ${thousands}rb`;
  }

  return `${sign}Rp ${formatNumber(abs)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function formatRobux(value: number): string {
  return `${formatNumber(value)} Robux`;
}

/**
 * Gamepass list price needed so the buyer receives `net` Robux after Roblox's
 * 30% cut. Rounded up so the buyer never comes out short.
 */
export function gamepassPriceForNet(net: number): number {
  return Math.ceil(net / ROBLOX_TAX_RATE);
}

/** Robux actually landing in the buyer's balance for a given gamepass price. */
export function netRobuxForGamepassPrice(price: number): number {
  return Math.floor(price * ROBLOX_TAX_RATE);
}

/** "12m 40s" / "2j 14m" / "47s" */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** 00:14:59 — used by SLA countdowns */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(total / 3600)).padStart(2, "0");
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

/**
 * Day label for chat separators: "Hari ini", "Kemarin", or the full date.
 * `now` is passed in (instead of read from the clock) so the label is
 * deterministic in tests, matching `relativeFromNow`.
 */
export function formatChatDay(iso: string, now: number): string {
  const dayKey = (value: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(value);

  const target = dayKey(new Date(iso));
  if (target === dayKey(new Date(now))) return "Hari ini";
  if (target === dayKey(new Date(now - 86_400_000))) return "Kemarin";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export function relativeFromNow(iso: string, now: number): string {
  const diffSeconds = Math.round((new Date(iso).getTime() - now) / 1000);
  if (diffSeconds <= 0) return "berakhir";
  return `${formatDuration(diffSeconds)} lagi`;
}

export function secondsUntil(iso: string, now: number): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Deterministic 0..1 from a string — keeps mock art stable across renders. */
export function seedFraction(seed: string, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}
