"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_RATE_CARD, repriceCatalog, type RateCard } from "@/lib/robux-pricing";
import {
  DEFAULT_ORDER_RATES,
  robuxOrderConfig,
  type GamepassTaxMode,
  type RobuxOrderConfig,
  type RobuxOrderKind,
  type RobuxOrderRates,
} from "@/lib/robux-orders";
import type { Product } from "@/lib/types";

export interface AdminRates {
  card: RateCard;
  orders: RobuxOrderRates;
}

export const DEFAULT_RATES: AdminRates = {
  card: DEFAULT_RATE_CARD,
  orders: DEFAULT_ORDER_RATES,
};

const STORAGE_KEY = "bloxastra.robux-rates.v1";

/**
 * Base rates the store falls back to when localStorage is empty. Seeded once
 * from <RateProvider initialRates={…}> (the server-read active RateCard) via a
 * mount-time initializer, so listing prices reflect the admin card without a
 * client round-trip. Falls back to the static defaults until seeded.
 */
let baseRates: AdminRates = DEFAULT_RATES;

/** One-shot seed hook. Runs during the provider's first mount only. */
function useSeedBaseRates(initialRates: AdminRates | undefined) {
  useState(() => {
    if (initialRates) baseRates = sanitize(initialRates) ?? DEFAULT_RATES;
    return null;
  });
}

const isNum = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/** volume discount tiers may legitimately be set to 0 */
const isNonNeg = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function sanitize(value: unknown): AdminRates | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AdminRates>;
  const card = raw.card;
  const orders = raw.orders;
  if (!card || typeof card !== "object" || !orders || typeof orders !== "object") return null;
  if (
    !isNum(card.cover) ||
    !isNum(card.noCover) ||
    !card.volume ||
    !isNonNeg(card.volume.at2000) ||
    !isNonNeg(card.volume.at5000) ||
    !isNonNeg(card.volume.at10000) ||
    !isNum(orders.username) ||
    !isNum(orders.login) ||
    !isNum(orders.gamepassCover) ||
    !isNum(orders.gamepassNoCover) ||
    !isNum(orders.adminFee)
  ) {
    return null;
  }
  return {
    card: {
      cover: card.cover,
      noCover: card.noCover,
      volume: {
        at2000: card.volume.at2000,
        at5000: card.volume.at5000,
        at10000: card.volume.at10000,
      },
    },
    orders: {
      username: orders.username,
      login: orders.login,
      gamepassCover: orders.gamepassCover,
      gamepassNoCover: orders.gamepassNoCover,
      premium: orders.premium,
      adminFee: orders.adminFee,
    },
  };
}

export function ratesEqual(a: AdminRates, b: AdminRates): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ─── tiny localStorage-backed store (no effects, no cascading renders) ─── */

let cache: AdminRates = DEFAULT_RATES;
// `undefined` means "not read yet". It must not start as `null`: null is also
// the raw value when the admin has no localStorage override, and treating the
// initial state as already-cached makes the store serve DEFAULT_RATES forever
// instead of the server-seeded card — buyers would silently see default rates.
let cacheRaw: string | null | undefined = undefined;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): AdminRates {
  if (!raw) return baseRates;
  try {
    return sanitize(JSON.parse(raw)) ?? baseRates;
  } catch {
    return baseRates;
  }
}

function getSnapshot(): AdminRates {
  const raw = readRaw();
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    cache = parseRaw(raw);
  }
  return cache;
}

function getServerSnapshot(): AdminRates {
  return baseRates;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function commit(next: AdminRates | null) {
  if (next) {
    const json = JSON.stringify(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, json);
    } catch {
      // private mode — the card still applies for this session
    }
    cache = next;
    cacheRaw = json;
  } else {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    cache = baseRates;
    cacheRaw = null;
  }
  for (const listener of listeners) listener();
}

interface RateContextValue {
  rates: AdminRates;
  /** persist the draft so every robux surface re-quotes immediately */
  apply: (next: AdminRates) => void;
  reset: () => void;
}

const RateContext = createContext<RateContextValue | null>(null);

/**
 * Holds the platform-wide robux rate card. Mounted once in the root layout
 * with the server-read active card as `initialRates`, so the static HTML
 * already carries real pricing; localStorage (admin preview) can still
 * override it on the client.
 */
export function RateProvider({
  initialRates,
  children,
}: {
  initialRates?: AdminRates;
  children: ReactNode;
}) {
  useSeedBaseRates(initialRates);
  const rates = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const apply = useCallback((next: AdminRates) => {
    const clean = sanitize(next);
    if (clean) commit(clean);
  }, []);

  const reset = useCallback(() => commit(null), []);

  const value = useMemo(() => ({ rates, apply, reset }), [rates, apply, reset]);

  return <RateContext.Provider value={value}>{children}</RateContext.Provider>;
}

export function useRateStore(): RateContextValue {
  const context = useContext(RateContext);
  if (!context) throw new Error("useRateStore must be used inside <RateProvider>");
  return context;
}

/** Rate card for listing quotes (catalog, buy box, checkout, packs). */
export function useRateCard(): RateCard {
  return useRateStore().rates.card;
}

/** Rate card for the three `/beli/robux-*` flows. */
export function useOrderRates(): RobuxOrderRates {
  return useRateStore().rates.orders;
}

/**
 * Flow config (rate + admin fee) with the applied card baked in. The gamepass
 * flow passes its tax mode because each mode has its own rate.
 */
export function useRobuxOrder(
  kind: RobuxOrderKind,
  taxMode: GamepassTaxMode = "cover",
): RobuxOrderConfig {
  const { rates } = useRateStore();
  return useMemo(
    () => robuxOrderConfig(kind, rates.orders, taxMode),
    [kind, rates.orders, taxMode],
  );
}

/** Catalog with robux listings re-quoted under the applied card. */
export function useCatalog<T extends Pick<Product, "price" | "netRobux" | "pricingMode">>(
  items: readonly T[],
): T[] {
  const card = useRateCard();
  return useMemo(() => repriceCatalog(items, card), [items, card]);
}
