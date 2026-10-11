import "server-only";
import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { DEFAULT_ORDER_RATES, type RobuxOrderRates } from "@/lib/robux-orders";
import { DEFAULT_RATE_CARD, type RateCard } from "@/lib/robux-pricing";

export type { RobuxOrderRates };

/**
 * Server-side readers for the active RateCard row. Falls back to the seeded
 * defaults when the admin has not published a card yet — same defaults the
 * client-side rate store uses, so guest and logged-in pricing match.
 */
export async function getActiveRateCard(): Promise<RateCard> {
  const row = await db.rateCard.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return DEFAULT_RATE_CARD;
  return {
    cover: row.cover,
    noCover: row.noCover,
    volume: { at2000: row.vol2000, at5000: row.vol5000, at10000: row.vol10000 },
  };
}

export async function getActiveOrderRates(): Promise<RobuxOrderRates> {
  const row = await db.rateCard.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return DEFAULT_ORDER_RATES;
  return {
    username: row.orderUsername,
    login: row.orderLogin,
    gamepass: row.orderGamepass,
    premium: row.orderPremium,
    adminFee: row.adminFee,
  };
}

/** Both cards for the admin rate editor (falls back to defaults). */
export async function getActiveRates(): Promise<{ card: RateCard; orders: RobuxOrderRates }> {
  const row = await db.rateCard.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  if (!row) return { card: DEFAULT_RATE_CARD, orders: DEFAULT_ORDER_RATES };
  return {
    card: {
      cover: row.cover,
      noCover: row.noCover,
      volume: { at2000: row.vol2000, at5000: row.vol5000, at10000: row.vol10000 },
    },
    orders: {
      username: row.orderUsername,
      login: row.orderLogin,
      gamepass: row.orderGamepass,
      premium: row.orderPremium,
      adminFee: row.adminFee,
    },
  };
}

/**
 * Cached variant for the root layout → RateProvider. Tagged "rates" so the
 * admin updateRateCard/resetRateCard actions can revalidateTag("rates") and
 * push new pricing to every listing surface without a full rebuild.
 */
export async function getCachedActiveRates(): Promise<{ card: RateCard; orders: RobuxOrderRates }> {
  "use cache";
  cacheTag("rates");
  return getActiveRates();
}
