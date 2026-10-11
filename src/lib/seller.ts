import "server-only";

import { db } from "@/lib/db";
import { maskWebhookUrl } from "@/lib/discord";
import { TIER_DAILY_CAPS } from "@/lib/order-meta";
import { getSellerWallet } from "@/lib/wallet";
import type { WalletView } from "@/lib/wallet";
export interface SellerInventoryItem {
  id: string;
  slug: string;
  title: string;
  game: string;
  price: number;
  stock: number;
  isListed: boolean;
  description: string;
  deliveryKind: string;
  autoReleaseHours: number;
  instantDelivery: boolean;
  imageUrl: string | null;
}

export interface SellerDashboard {
  sellerId: string;
  storeName: string;
  handle: string;
  tier: 1 | 2 | 3;
  isOnline: boolean;
  hasExpressBadge: boolean;
  avgDeliverySeconds: number;
  disputeRatePercent: number;
  ordersCompleted: number;
  kycVerified: boolean;
  kycStatus: string;
  kycRejectReason: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  todayVolume: number;
  dailyCap: number;
  completedToday: number;
  /** every order ever routed to this seller, any status */
  ordersTotal: number;
  weekSeries: number[];
  weekLabels: string[];
  wallet: WalletView;
  /** seller withdrawals still waiting for admin approval */
  pendingWithdrawals: number;
}

const WEEK_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function startOfToday(): Date {
  // Asia/Jakarta day boundary, computed independent of the host timezone
  // (a UTC host would otherwise skew buckets up to 7h).
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
  const asUtc = Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day")));
  // WIB = UTC+7, so Jakarta midnight equals 17:00 UTC the day before.
  return new Date(asUtc - 7 * 3_600_000);
}

/** Seller dashboard aggregate for the logged-in seller user. */
export async function getSellerDashboard(userId: string): Promise<SellerDashboard | null> {
  const profile = await db.sellerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  const today = startOfToday();
  const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 3600 * 1000);

  const [
    wallet,
    todayEarnings,
    completedToday,
    weekOrders,
    totalOrders,
    completedOrders,
    disputeCount,
    pendingWithdrawals,
    recentCompleted,
    account,
  ] = await Promise.all([
    getSellerWallet(userId),
    db.walletLedger.aggregate({
      where: { userId, sellerId: profile.id, type: "earning", createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    db.orderEvent.count({
      where: {
        state: "completed",
        at: { gte: today },
        order: { sellerId: profile.id },
      },
    }),
    db.order.findMany({
      where: { sellerId: profile.id, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true },
    }),
    db.order.count({ where: { sellerId: profile.id } }),
    db.order.count({ where: { sellerId: profile.id, status: "completed" } }),
    db.dispute.count({ where: { order: { sellerId: profile.id } } }),
    db.withdrawal.count({ where: { sellerId: profile.id, status: "pending" } }),
    db.order.findMany({
      where: { sellerId: profile.id, status: "completed" },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: { events: { select: { state: true, at: true } } },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    }),
  ]);

  // Real delivery time: paid → completed on the most recent fulfilled orders.
  // Falls back to the profile baseline when the seller has no completed order yet.
  const samples: number[] = [];
  for (const order of recentCompleted) {
    const paidAt = order.events.find((event) => event.state === "paid")?.at;
    const completedAt = order.events.find((event) => event.state === "completed")?.at;
    if (paidAt && completedAt && completedAt >= paidAt) {
      samples.push(Math.floor((completedAt.getTime() - paidAt.getTime()) / 1000));
    }
  }
  const avgDeliverySeconds = samples.length
    ? Math.round(samples.reduce((sum, value) => sum + value, 0) / samples.length)
    : profile.avgDeliverySeconds;

  // Real dispute rate: all disputes against this seller's orders, ever.
  const disputeRatePercent =
    totalOrders > 0
      ? Math.round((disputeCount / totalOrders) * 10000) / 100
      : profile.disputeRatePercent;

  const weekSeries = Array.from({ length: 7 }, (_, index) => {
    const dayStart = new Date(sevenDaysAgo.getTime() + index * 24 * 3600 * 1000);
    const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
    return weekOrders.filter(
      (order) => order.createdAt >= dayStart && order.createdAt < dayEnd,
    ).length;
  });
  const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" });
  const weekLabels = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(sevenDaysAgo.getTime() + index * 24 * 3600 * 1000);
    // WEEK_LABELS follows JS getDay() order (0 = Min/Minggu).
    const short = weekdayFmt.format(day);
    const jsDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
    return WEEK_LABELS[jsDay >= 0 ? jsDay : day.getDay()];
  });

  return {
    sellerId: profile.id,
    storeName: profile.storeName,
    handle: profile.handle,
    tier: profile.tier as 1 | 2 | 3,
    isOnline: profile.isOnline,
    hasExpressBadge: profile.hasExpressBadge,
    avgDeliverySeconds,
    disputeRatePercent,
    ordersCompleted: completedOrders,
    kycVerified: profile.kycVerified,
    kycStatus: account?.kycStatus ?? "none",
    kycRejectReason: profile.kycRejectReason,
    city: profile.city,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    todayVolume: todayEarnings._sum.amount ?? 0,
    dailyCap: TIER_DAILY_CAPS[profile.tier as 1 | 2 | 3] ?? TIER_DAILY_CAPS[1],
    completedToday,
    ordersTotal: totalOrders,
    weekSeries,
    weekLabels,
    pendingWithdrawals,
    wallet,
  };
}

/**
 * Light profile lookup for seller routes that only need identity and status.
 * The full `getSellerDashboard` aggregate runs eleven queries; the dedicated
 * Pesanan / Listing routes have no use for most of them.
 */
export interface SellerIdentity {
  sellerId: string;
  storeName: string;
  handle: string;
  tier: 1 | 2 | 3;
  isOnline: boolean;
  hasExpressBadge: boolean;
  kycVerified: boolean;
  kycStatus: string;
  kycRejectReason: string | null;
  city: string;
  rating: number;
  reviewCount: number;
  /** Discord pool-alert webhook presence (the URL itself never leaves the server). */
  discordWebhook: { configured: boolean; masked: string | null; enabled: boolean };
}

export async function getSellerIdentity(userId: string): Promise<SellerIdentity | null> {
  const profile = await db.sellerProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      storeName: true,
      handle: true,
      tier: true,
      isOnline: true,
      hasExpressBadge: true,
      kycVerified: true,
      kycRejectReason: true,
      city: true,
      rating: true,
      reviewCount: true,
      discordWebhookUrl: true,
      discordWebhookEnabled: true,
      user: { select: { kycStatus: true } },
    },
  });
  if (!profile) return null;
  return {
    sellerId: profile.id,
    storeName: profile.storeName,
    handle: profile.handle,
    tier: profile.tier as 1 | 2 | 3,
    isOnline: profile.isOnline,
    hasExpressBadge: profile.hasExpressBadge,
    kycVerified: profile.kycVerified,
    kycStatus: profile.user.kycStatus,
    kycRejectReason: profile.kycRejectReason,
    city: profile.city,
    rating: profile.rating,
    reviewCount: profile.reviewCount,
    discordWebhook: {
      configured: Boolean(profile.discordWebhookUrl),
      masked: profile.discordWebhookUrl ? maskWebhookUrl(profile.discordWebhookUrl) : null,
      enabled: profile.discordWebhookEnabled,
    },
  };
}

/**
 * Every listing the seller owns, newest first. The dashboard aggregate caps
 * this at 12 for its summary strip; a dedicated workspace needs the real set.
 */
export async function getSellerInventory(sellerId: string): Promise<SellerInventoryItem[]> {
  return db.product.findMany({
    where: { sellerId },
    select: {
      id: true,
      slug: true,
      title: true,
      game: true,
      price: true,
      stock: true,
      isListed: true,
      description: true,
      deliveryKind: true,
      autoReleaseHours: true,
      instantDelivery: true,
      imageUrl: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export interface SellerChatItem {
  id: string;
  body: string;
  createdAt: string;
  username: string;
  storeName: string | null;
  isSelf: boolean;
}

/** Global seller group chat (last 200 messages, oldest first). */
export async function getSellerChat(viewerId: string): Promise<SellerChatItem[]> {
  const rows = await db.sellerChatMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      body: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          username: true,
          sellerProfile: { select: { storeName: true } },
        },
      },
    },
  });
  return rows
    .reverse()
    .map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      username: row.user.username,
      storeName: row.user.sellerProfile?.storeName ?? null,
      isSelf: row.user.id === viewerId,
    }));
}
