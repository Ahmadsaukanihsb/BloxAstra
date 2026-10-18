import "server-only";

import { db } from "@/lib/db";
import { maskWebhookUrl } from "@/lib/discord";
import type { MentionTarget } from "@/lib/mentions";
import { listOnlineSellers, type OnlineSeller } from "@/lib/presence";
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

/** The message a reply quotes, flattened so the room never ships its body twice. */
export interface SellerChatQuote {
  id: string;
  author: string;
  /** One-line preview, truncated server-side. Empty when the original was deleted. */
  excerpt: string;
  deleted: boolean;
}

export interface SellerChatItem {
  id: string;
  /** Empty once deleted: the tombstone text is the client's, not the row's. */
  body: string;
  createdAt: string;
  username: string;
  storeName: string | null;
  isSelf: boolean;
  deleted: boolean;
  edited: boolean;
  replyTo: SellerChatQuote | null;
}

/** Collapse and clip a message for a quote preview. */
function quoteExcerpt(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > 140 ? `${flat.slice(0, 139)}…` : flat;
}

/** Global seller group chat (last 200 messages, oldest first). */
export interface ChatRevision {
  count: number;
  latestId: string | null;
}

/**
 * Fingerprint of the shared room: total messages plus the newest id. Lets an
 * open chat ask "anything new?" every few seconds and skip the RSC refetch
 * when the answer is no.
 */
export async function getSellerChatRevision(): Promise<ChatRevision> {
  const [count, latest] = await Promise.all([
    db.sellerChatMessage.count(),
    db.sellerChatMessage.findFirst({
      orderBy: { createdAt: "desc" },
      select: { id: true },
    }),
  ]);
  return { count, latestId: latest?.id ?? null };
}

export interface SellerChatUnread {
  /** Messages from other sellers posted since this viewer last opened the room. */
  count: number;
  /** Where the "pesan baru" divider goes. Null on a first visit or a quiet room. */
  firstUnreadId: string | null;
}

export interface SellerChatView {
  items: SellerChatItem[];
  unread: SellerChatUnread;
  /** Shops the composer can call out with `@`. */
  mentionable: MentionTarget[];
  /** Sellers with a live stream right now, this viewer excluded. */
  online: OnlineSeller[];
}

/**
 * Every shop a message can call out by name. Capped: the room is one shared
 * page and the full directory rides the initial payload for the `@` menu.
 */
export async function getMentionDirectory(limit = 300): Promise<MentionTarget[]> {
  const rows = await db.sellerProfile.findMany({
    select: { userId: true, storeName: true, user: { select: { username: true } } },
    orderBy: { storeName: "asc" },
    take: limit,
  });
  return rows.map((row) => ({
    userId: row.userId,
    storeName: row.storeName,
    username: row.user.username,
  }));
}

/**
 * How many group-room messages this user has not seen yet — the number on the
 * nav badge. Zero until the room has been opened once, which is the same rule
 * the divider follows: a brand-new account is not handed 200 "unread" messages.
 * Messages this user posted are never counted, at any age.
 */
export async function getSellerChatUnreadCount(userId: string): Promise<number> {
  const viewer = await db.user.findUnique({
    where: { id: userId },
    select: { groupChatSeenAt: true },
  });
  const seenAt = viewer?.groupChatSeenAt ?? null;
  if (!seenAt) return 0;
  return db.sellerChatMessage.count({
    where: { createdAt: { gt: seenAt }, userId: { not: userId }, deletedAt: null },
  });
}

/**
 * The room plus this viewer's place in it.
 *
 * The unread cursor is read, never advanced, here: a render decides what to
 * draw, and the open room advances the cursor through a server action once the
 * reader has actually seen the messages on screen.
 */
export async function getSellerChat(viewerId: string): Promise<SellerChatView> {
  const [rows, viewer, mentionable] = await Promise.all([
    db.sellerChatMessage.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        body: true,
        createdAt: true,
        editedAt: true,
        deletedAt: true,
        user: {
          select: {
            id: true,
            username: true,
            sellerProfile: { select: { storeName: true } },
          },
        },
        replyTo: {
          select: {
            id: true,
            body: true,
            deletedAt: true,
            user: {
              select: {
                username: true,
                sellerProfile: { select: { storeName: true } },
              },
            },
          },
        },
      },
    }),
    db.user.findUnique({ where: { id: viewerId }, select: { groupChatSeenAt: true } }),
    getMentionDirectory(),
  ]);

  const items = rows
    .reverse()
    .map((row) => ({
      id: row.id,
      // A deleted message keeps its row but loses its words — the tombstone
      // the reader sees is rendered, never stored.
      body: row.deletedAt ? "" : row.body,
      createdAt: row.createdAt.toISOString(),
      username: row.user.username,
      storeName: row.user.sellerProfile?.storeName ?? null,
      isSelf: row.user.id === viewerId,
      deleted: row.deletedAt !== null,
      edited: row.editedAt !== null,
      replyTo: row.replyTo
        ? {
            id: row.replyTo.id,
            author:
              row.replyTo.user.sellerProfile?.storeName ?? row.replyTo.user.username,
            excerpt: row.replyTo.deletedAt ? "" : quoteExcerpt(row.replyTo.body),
            deleted: row.replyTo.deletedAt !== null,
          }
        : null,
    }));

  // A first visit (no cursor) is not "200 unread" — the room simply opens
  // clean, and the cursor is written from the client on mount.
  // A tombstone is not something anyone can still read, so it never counts as
  // unread and never hosts the divider.
  const seenAt = viewer?.groupChatSeenAt ?? null;
  const fresh = seenAt
    ? items.filter(
        (item) =>
          !item.isSelf && !item.deleted && new Date(item.createdAt).getTime() > seenAt.getTime(),
      )
    : [];

  return {
    items,
    unread: { count: fresh.length, firstUnreadId: fresh[0]?.id ?? null },
    mentionable,
    online: listOnlineSellers(viewerId),
  };
}
