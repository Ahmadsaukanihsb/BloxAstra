import "server-only";
import { db } from "@/lib/db";
import { isUserOnline } from "@/lib/presence";
import { decryptCredentials, maskSecret } from "@/lib/credentials";
import { poolKindLabel } from "@/lib/discord";
import { ACTIVE_ORDER_STATES, ESCROW_ORDER_STATES } from "@/lib/order-meta";
import { getSweepTimeouts } from "@/lib/sweep";
import type { CategorySlug, OrderState } from "@/lib/types";

/** Role of the viewer inside an order room. */
export type OrderViewerRole = "buyer" | "seller" | "admin";

export interface OrderListItem {
  id: string;
  code: string;
  state: OrderState;
  productTitle: string;
  productSlug: string | null;
  category: CategorySlug | null;
  sellerStore: string;
  /** Seller's shop image (data URL), null = monogram initials */
  sellerStoreImage: string | null;
  robloxUsername: string | null;
  total: number;
  createdAt: string;
  expressBadge: boolean;
  isPoolOrder: boolean;
  /** seconds left on the active SLA (null when no clock runs) */
  slaRemainingSeconds: number | null;
  slaLabel: string | null;
  /** messages from the other side the viewer has not opened the room to read */
  unread: number;
}

export interface OrderTimelineEntry {
  state: OrderState;
  label: string;
  at: string;
  note: string | null;
  actor: "system" | "buyer" | "seller" | "admin";
}

export interface OrderRoomMessage {
  id: string;
  from: "system" | "buyer" | "seller" | "admin";
  text: string;
  /** data-URL chat attachment (null for text-only messages) */
  image: string | null;
  at: string;
}

export interface OrderDisputeInfo {
  ref: string;
  reasonId: string;
  reasonLabel: string;
  buyerNote: string;
  sellerReply: string;
  evidence: string[];
  openedAt: string;
  status: string;
  slaHoursLeft: number;
}

export interface OrderDetail extends OrderListItem {
  unitPrice: number;
  platformFee: number;
  quantity: number;
  kind: string;
  autoReleaseAt: string | null;
  createdAtFull: string;
  buyerName: string;
  /** Buyer's profile photo (data URL) — rendered on the seller/admin view. */
  buyerImage: string | null;
  sellerStoreName: string;
  sellerHandle: string;
  sellerTier: 1 | 2 | 3;
  sellerIsOnline: boolean;
  sellerRating: number;
  sellerReviewCount: number;
  sellerAvgDeliverySeconds: number;
  sellerOrdersCompleted: number;
  sellerDisputeRatePercent: number;
  categorySlug: CategorySlug | null;
  categoryName: string | null;
  categorySlaMinutes: number | null;
  categoryFulfillment: string | null;
  /** Seller/admin-set listing photo; null = generative art on the slug. */
  productImageUrl: string | null;
  paymentCheckoutUrl: string | null;
  paymentStatus: string | null;
  /** Buyer's "barang diterima": live only once the seller marked it shipped. */
  canConfirm: boolean;
  /** Buyer is waiting for the seller to press "tandai barang terkirim". */
  awaitingShipment: boolean;
  canCancelAfk: boolean;
  viewerRole: OrderViewerRole;
  credentials: {
    username: string;
    passwordMasked: string;
    parentalPinMasked: string;
    twoFactorMasked: string;
  } | null;
  gamepassUrl: string | null;
  buyerNote: string | null;
  handoverSteps: { id: string; label: string; hint: string; done: boolean }[];
  timeline: OrderTimelineEntry[];
  dispute: OrderDisputeInfo | null;
}

type OrderRow = Awaited<ReturnType<typeof fetchOrderRow>>;
type OrderRowResult = OrderRow | null;

/** Minimal projection the list mapper needs — accepts the full room row too. */
interface ListProjection {
  id: string;
  code: string;
  status: string;
  kind: string;
  buyerId: string;
  robuxAmount: number | null;
  robloxUsername: string | null;
  total: number;
  expressBadge: boolean;
  isPoolOrder: boolean;
  createdAt: Date;
  autoReleaseAt: Date | null;
  buyerReadAt: Date | null;
  sellerReadAt: Date | null;
  payment: { expiresAt: Date | null } | null;
  product: {
    title: string;
    slug: string;
    category: { slug: string; name: string; slaMinutes: number; fulfillment: string };
  } | null;
  seller: { storeName: string; storeImage: string | null } | null;
  events: { state: string; at: Date }[];
  /** chat metadata only — never the bodies/attachments, so lists stay light */
  messages: { fromRole: string; at: Date }[];
  dispute: { id: string } | null;
}

const ROOM_INCLUDE = {
  buyer: { select: { username: true } },
  product: {
    select: {
      title: true,
      slug: true,
      imageUrl: true,
      autoReleaseHours: true,
      category: { select: { slug: true, name: true, slaMinutes: true, fulfillment: true } },
    },
  },
  seller: {
    select: {
      storeName: true,
      storeImage: true,
      handle: true,
      tier: true,
      isOnline: true,
      rating: true,
      reviewCount: true,
      avgDeliverySeconds: true,
      ordersCompleted: true,
      disputeRatePercent: true,
    },
  },
  events: { orderBy: { at: "asc" as const } },
  // Chat metadata only: bodies and attachments stay out of every list query,
  // and this is still everything the unread badge needs.
  messages: { select: { fromRole: true, at: true }, orderBy: { at: "asc" as const } },
  dispute: true,
  payment: { select: { expiresAt: true, status: true, checkoutUrl: true } },
} satisfies NonNullable<Parameters<typeof db.order.findUnique>[0]>["include"];

function fetchOrderRow(where: { id: string } | { code: string }) {
  return db.order.findUnique({ where, include: ROOM_INCLUDE });
}

function asState(status: string): OrderState {
  return status as OrderState;
}

/**
 * `Dispute.evidence` is free-text JSON. A hand-edited or half-written value
 * must never throw here — an unparsable blob would 500 the whole order room
 * for buyer, seller and admin at once. Fall back to an empty list.
 */
function safeParseEvidence(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function categoryOf(row: ListProjection | OrderRowResult): CategorySlug | null {
  const fromProduct = (row?.product?.category.slug ?? null) as CategorySlug | null;
  if (fromProduct) return fromProduct;
  // Non-catalog flows carry their category on `kind` so the order list can badge
  // them the same way it badges a listing.
  switch (row?.kind) {
    case "robux_username":
    case "robux_login":
    case "robux_gamepass":
      return "gamepass";
    case "premium":
      return "premium";
    default:
      return null;
  }
}

/** seconds left on the running SLA clock for this order, plus its label */
function computeSla(
  row: ListProjection | NonNullable<OrderRowResult>,
  now: number,
): { seconds: number | null; label: string | null } {
  const state = asState(row.status);
  if (state === "shipped" && row.autoReleaseAt) {
    return {
      seconds: Math.max(0, Math.floor((row.autoReleaseAt.getTime() - now) / 1000)),
      label: "Konfirmasi otomatis dana",
    };
  }
  if (state === "paid") {
    const paidEvent = row.events.find((event) => event.state === "paid");
    if (paidEvent) {
      return {
        seconds: Math.max(0, Math.floor((paidEvent.at.getTime() + 30 * 60_000 - now) / 1000)),
        label: "Batas penjual mulai proses",
      };
    }
  }
  if (state === "processing") {
    const processingEvent = row.events.find((event) => event.state === "processing");
    const slaMinutes = row.product?.category.slaMinutes ?? 45;
    if (processingEvent) {
      return {
        seconds: Math.max(0, Math.floor((processingEvent.at.getTime() + slaMinutes * 60_000 - now) / 1000)),
        label: `SLA kategori ${row.product?.category.name ?? "pesanan"}`,
      };
    }
  }
  if (state === "pending_payment" && row.payment?.expiresAt) {
    return {
      seconds: Math.max(0, Math.floor((row.payment.expiresAt.getTime() - now) / 1000)),
      label: "Batas pembayaran",
    };
  }
  if (state === "disputed") {
    return { seconds: null, label: "Keputusan admin maksimal 1×24 jam" };
  }
  return { seconds: null, label: null };
}

function canCancelAfk(row: ListProjection | NonNullable<OrderRowResult>, now: number): boolean {
  if (asState(row.status) !== "processing") return false;
  if (row.dispute) return false;
  const processingEvent = row.events.find((event) => event.state === "processing");
  if (!processingEvent) return false;
  return now - processingEvent.at.getTime() > 30 * 60_000;
}

const HANDOVER_STEPS = [
  { id: "pin", label: "Setel ulang Parental PIN", hint: "Pastikan PIN lama sudah diganti ke kombinasi baru." },
  { id: "sessions", label: "Cabut sesi lama", hint: "Keluar dari semua perangkat yang masih login." },
  { id: "handover", label: "Serah terima kredensial", hint: "Salin username, password, dan PIN dari panel kredensial." },
  { id: "verify", label: "Verifikasi akses masuk", hint: "Login ke Roblox dengan kredensial baru untuk memastikan works." },
  { id: "rotate", label: "Rotasi keamanan akun", hint: "Ganti email & nomor telepon terikat setelah serah terima." },
] as const;

/**
 * Unread chat messages for the viewer on one order: anything the other side
 * sent after the viewer's read cursor. A `system` message is written by the
 * order itself (a status move), not by the counterparty, so it never raises a
 * badge — otherwise acting on your own order would ping you. `viewerId` null
 * (pool browsing, admin lists) always reads as zero — no cursor, no badge.
 */
function unreadFor(row: ListProjection, viewerId: string | null): number {
  if (!viewerId) return 0;
  const isBuyer = row.buyerId === viewerId;
  const counterpartRole = isBuyer ? "seller" : "buyer";
  const cursor = isBuyer ? row.buyerReadAt : row.sellerReadAt;
  const cutoff = cursor ? cursor.getTime() : 0;
  return row.messages.filter(
    (message) => message.fromRole === counterpartRole && message.at.getTime() > cutoff,
  ).length;
}

function toListItem(row: ListProjection, now: number, unread: number): OrderListItem {
  const sla = computeSla(row, now);
  return {
    id: row.id,
    code: row.code,
    state: asState(row.status),
    productTitle: row.product?.title ?? `${row.robuxAmount ?? 0} Robux`,
    productSlug: row.product?.slug ?? null,
    category: categoryOf(row),
    sellerStore: row.seller?.storeName ?? "Blox Astra",
    sellerStoreImage: row.seller?.storeImage ?? null,
    robloxUsername: row.robloxUsername,
    total: row.total,
    createdAt: row.createdAt.toISOString(),
    expressBadge: row.expressBadge,
    isPoolOrder: row.isPoolOrder,
    slaRemainingSeconds: sla.seconds,
    slaLabel: sla.label,
    unread,
  };
}

/** Aggregate a row set into the list-tab shape shared by all order lists. */
function summarizeOrders(
  rows: Parameters<typeof toListItem>[0][],
  now: number,
  viewerId: string | null,
): {
  orders: OrderListItem[];
  heldTotal: number;
  activeCount: number;
  lifetimeTotal: number;
} {
  const orders = rows.map((row) => toListItem(row, now, unreadFor(row, viewerId)));
  const heldTotal = orders
    .filter((order) => ESCROW_ORDER_STATES.includes(order.state))
    .reduce((sum, order) => sum + order.total, 0);
  const activeCount = orders.filter((order) => ACTIVE_ORDER_STATES.includes(order.state)).length;
  const lifetimeTotal = orders
    .filter((order) => !["cancelled", "refunded"].includes(order.state))
    .reduce((sum, order) => sum + order.total, 0);

  return { orders, heldTotal, activeCount, lifetimeTotal };
}

/** Buyer's order list (newest first) with list-tab aggregates. */
export async function getBuyerOrders(userId: string): Promise<{
  orders: OrderListItem[];
  heldTotal: number;
  activeCount: number;
  lifetimeTotal: number;
}> {
  const rows = await db.order.findMany({
    where: { buyerId: userId },
    orderBy: { createdAt: "desc" },
    include: ROOM_INCLUDE,
  });
  return summarizeOrders(rows, Date.now(), userId);
}

/** All orders the viewer touches: purchases + (for sellers) sales, deduped. */
export async function getOrdersForViewer(user: {
  id: string;
  role: string;
}): Promise<{
  orders: OrderListItem[];
  heldTotal: number;
  activeCount: number;
  lifetimeTotal: number;
}> {
  const now = Date.now();
  const profile =
    user.role === "buyer"
      ? null
      : await db.sellerProfile.findUnique({ where: { userId: user.id }, select: { id: true } });

  const [buyerRows, sellerRows] = await Promise.all([
    db.order.findMany({
      where: { buyerId: user.id },
      orderBy: { createdAt: "desc" },
      include: ROOM_INCLUDE,
    }),
    profile
      ? db.order.findMany({
          where: { sellerId: profile.id },
          orderBy: { createdAt: "desc" },
          include: ROOM_INCLUDE,
        })
      : Promise.resolve([]),
  ]);

  const merged = new Map<string, (typeof buyerRows)[number]>();
  for (const row of [...buyerRows, ...sellerRows]) merged.set(row.id, row);
  const rows = [...merged.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );

  return summarizeOrders(rows, now, user.id);
}

/** Full order-room payload for /pesanan/[code]. Returns null when not found. */
export async function getOrderRoom(
  code: string,
  viewer: { id: string; role: string },
): Promise<OrderDetail | null> {
  const row = await fetchOrderRow({ code });
  if (!row) return null;

  const isBuyer = row.buyerId === viewer.id;
  let isSeller = false;
  if (row.sellerId) {
    const profile = await db.sellerProfile.findUnique({
      where: { id: row.sellerId },
      select: { userId: true },
    });
    isSeller = profile?.userId === viewer.id;
  } else if (viewer.role === "seller") {
    // Pool orders are visible to any seller so they can claim them.
    isSeller = true;
  }
  if (!isBuyer && !isSeller && viewer.role !== "admin") return null;

  const now = Date.now();
  const viewerRole: OrderViewerRole = viewer.role === "admin" && !isBuyer && !isSeller ? "admin" : isBuyer ? "buyer" : "seller";
  // Admins moderate, they do not correspond: like `getOrderUnreadTotal`, their
  // badge stays at zero instead of counting every message they never "read"
  // (markOrderSeen deliberately never moves an admin's cursor).
  const base = toListItem(row, now, viewerRole === "admin" ? 0 : unreadFor(row, viewer.id));

  // Buyer avatars are data URLs (up to 500KB), so they stay out of the shared
  // list include and are fetched here only. The seller/admin side renders the
  // buyer's photo (counterpart + messages); the buyer side renders it on their
  // own messages — so it is fetched for every viewer.
  const buyerImage =
    (
      await db.user.findUnique({
        where: { id: row.buyerId },
        select: { avatarImage: true },
      })
    )?.avatarImage ?? null;

  let credentials: OrderDetail["credentials"] = null;
  if (row.credentialsEnc) {
    try {
      const decrypted = decryptCredentials(row.credentialsEnc);
      credentials = {
        username: row.robloxUsername ?? "",
        passwordMasked: decrypted.password ? maskSecret(decrypted.password) : "",
        parentalPinMasked: decrypted.parentalPin ? maskSecret(decrypted.parentalPin) : "",
        twoFactorMasked: decrypted.twoFactorBackupCodes
          ? `${decrypted.twoFactorBackupCodes.split(" ").filter(Boolean).length} kode tersimpan`
          : "",
      };
    } catch {
      credentials = null;
    }
  }

  const state = asState(row.status);
  const dispute = row.dispute
    ? {
        ref: row.dispute.ref,
        reasonId: row.dispute.reasonId,
        reasonLabel: row.dispute.reasonLabel,
        buyerNote: row.dispute.buyerNote,
        sellerReply: row.dispute.sellerReply,
        evidence: safeParseEvidence(row.dispute.evidence),
        openedAt: row.dispute.openedAt.toISOString(),
        status: row.dispute.status,
        slaHoursLeft: row.dispute.slaHoursLeft,
      }
    : null;

  return {
    ...base,
    unitPrice: row.unitPrice,
    platformFee: row.platformFee,
    quantity: row.quantity,
    kind: row.kind,
    autoReleaseAt: row.autoReleaseAt?.toISOString() ?? null,
    createdAtFull: row.createdAt.toISOString(),
    buyerName: row.buyer.username,
    buyerImage,
    gamepassUrl: row.gamepassUrl,
    buyerNote: row.buyerNote,
    sellerStoreName: row.seller?.storeName ?? "Blox Astra",
    sellerHandle: row.seller?.handle ?? "bloxastra",
    sellerTier: (row.seller?.tier ?? 1) as 1 | 2 | 3,
    sellerIsOnline: row.seller?.isOnline ?? false,
    sellerRating: row.seller?.rating ?? 0,
    sellerReviewCount: row.seller?.reviewCount ?? 0,
    sellerAvgDeliverySeconds: row.seller?.avgDeliverySeconds ?? 600,
    sellerOrdersCompleted: row.seller?.ordersCompleted ?? 0,
    sellerDisputeRatePercent: row.seller?.disputeRatePercent ?? 0,
    categorySlug: categoryOf(row),
    categoryName: row.product?.category.name ?? null,
    categorySlaMinutes: row.product?.category.slaMinutes ?? null,
    categoryFulfillment: row.product?.category.fulfillment ?? null,
    productImageUrl: row.product?.imageUrl ?? null,
    paymentCheckoutUrl: row.payment?.checkoutUrl ?? null,
    paymentStatus: row.payment?.status ?? null,
    // The escrow confirm window opens at delivery: before the seller marks
    // the order shipped there is nothing to confirm (the server rejects it).
    canConfirm: state === "shipped" && viewerRole === "buyer",
    // Mirror of the above for the disabled state: the buyer sees the button
    // locked while the order is still being processed.
    awaitingShipment:
      viewerRole === "buyer" &&
      // Unclaimed pool orders have no seller yet — no button until claimed.
      row.sellerId !== null &&
      ["paid", "processing"].includes(state),
    canCancelAfk: canCancelAfk(row, now) && viewerRole === "buyer",
    viewerRole,
    credentials,
    handoverSteps: credentials ? HANDOVER_STEPS.map((step) => ({ ...step, done: false })) : [],
    timeline: row.events.map((event) => ({
      state: asState(event.state),
      label: event.label,
      at: event.at.toISOString(),
      note: event.note,
      actor: event.actor as OrderTimelineEntry["actor"],
    })),
    dispute,
  };
}

/** Chat messages for an order (chronological). */
export async function getOrderMessages(orderId: string): Promise<OrderRoomMessage[]> {
  const rows = await db.message.findMany({
    where: { orderId },
    orderBy: { at: "asc" },
    select: { id: true, fromRole: true, body: true, image: true, at: true },
  });
  return rows.map((row) => ({
    id: row.id,
    from: row.fromRole as OrderRoomMessage["from"],
    text: row.body,
    image: row.image,
    at: row.at.toISOString(),
  }));
}

/**
 * Every unread chat message across the viewer's orders, for the "Pesanan" nav
 * badge. One count per side (as buyer, and as seller when a profile exists),
 * both expressed as a join against the per-order read cursor so the number
 * matches the per-row badges exactly.
 */
export async function getOrderUnreadTotal(userId: string, role: string): Promise<number> {
  if (role === "admin") return 0;
  const profile = await db.sellerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  const [buyerRows, sellerRows] = await Promise.all([
    db.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "Message" m JOIN "Order" o ON o.id = m."orderId"
      WHERE o."buyerId" = ${userId}
        AND m."fromRole" = 'seller'
        AND (o."buyerReadAt" IS NULL OR m."at" > o."buyerReadAt")
    `,
    profile
      ? db.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count
          FROM "Message" m JOIN "Order" o ON o.id = m."orderId"
          WHERE o."sellerId" = ${profile.id}
            AND m."fromRole" = 'buyer'
            AND (o."sellerReadAt" IS NULL OR m."at" > o."sellerReadAt")
        `
      : Promise.resolve([]),
  ]);
  return Number(buyerRows[0]?.count ?? 0) + Number(sellerRows[0]?.count ?? 0);
}

export interface OrderChatPresence {
  buyerOnline: boolean;
  sellerOnline: boolean;
  /** when each side last opened this room (their read cursor) */
  buyerLastSeenAt: string | null;
  sellerLastSeenAt: string | null;
}

/** Who is around in an order room right now, and when each side last looked. */
export async function getOrderChatPresence(orderId: string): Promise<OrderChatPresence> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      buyerId: true,
      buyerReadAt: true,
      sellerReadAt: true,
      seller: { select: { userId: true } },
    },
  });
  if (!order) {
    return { buyerOnline: false, sellerOnline: false, buyerLastSeenAt: null, sellerLastSeenAt: null };
  }
  return {
    buyerOnline: isUserOnline(order.buyerId),
    sellerOnline: order.seller ? isUserOnline(order.seller.userId) : false,
    buyerLastSeenAt: order.buyerReadAt?.toISOString() ?? null,
    sellerLastSeenAt: order.sellerReadAt?.toISOString() ?? null,
  };
}

export interface OrderReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  buyerName: string;
}

/** The buyer's review for one order, if they left one. */
export async function getOrderReview(orderId: string): Promise<OrderReview | null> {
  const row = await db.review.findUnique({
    where: { orderId },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      buyer: { select: { username: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    buyerName: row.buyer.username,
  };
}

export interface RecentReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  buyerName: string;
  productTitle: string;
}

/**
 * Newest buyer reviews across the whole catalog, for the homepage proof
 * strip. Empty comments are skipped — a star row without words proves
 * nothing to a first-time visitor.
 */
export async function getRecentReviews(limit = 4): Promise<RecentReview[]> {
  const rows = await db.review.findMany({
    where: { comment: { not: "" }, hidden: false },
    orderBy: { createdAt: "desc" },
    take: Math.max(1, Math.min(limit, 8)),
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      buyer: { select: { username: true } },
      product: { select: { title: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    buyerName: row.buyer.username,
    productTitle: row.product?.title ?? "Robux",
  }));
}

/** Public reviews for a product listing (newest first, hidden excluded). */
export async function getProductReviews(productId: string): Promise<OrderReview[]> {
  const rows = await db.review.findMany({
    where: { productId, hidden: false },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      buyer: { select: { username: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    buyerName: row.buyer.username,
  }));
}

/** Unassigned paid pool orders available for any seller to claim. */
export async function getPoolOrders(): Promise<OrderListItem[]> {
  const now = Date.now();
  const rows = await db.order.findMany({
    where: { sellerId: null, status: "paid", isPoolOrder: true },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: ROOM_INCLUDE,
  });
  return rows.map((row) => toListItem(row, now, 0));
}

export interface RobuxPoolItem {
  id: string;
  code: string;
  kind: string;
  kindLabel: string;
  robuxAmount: number | null;
  robloxUsername: string | null;
  total: number;
  expressBadge: boolean;
  createdAt: string;
  /** Seconds left before the pool refund window closes; 0 = still claimable. */
  claimSecondsLeft: number;
  /**
   * False once the window is past. The card then says "lewat jendela" instead
   * of "berakhir": the sweep refunds on its own, and until it runs the order is
   * still claimable — calling that "berakhir" read as "you can stop refreshing".
   */
  claimable: boolean;
}

/** Paid Robux/premium pool orders that sellers fight over (rebutan). */
export async function getRobuxPool(): Promise<RobuxPoolItem[]> {
  const now = Date.now();
  // One source for the window: the same setting the sweep refunds on. This used
  // to be a hardcoded 30 minutes while the sweep used `poolHours` (24h default),
  // so the UI clock expired the order ~23 hours before the server did.
  const { poolHours } = await getSweepTimeouts();
  const rows = await db.order.findMany({
    where: {
      sellerId: null,
      status: "paid",
      isPoolOrder: true,
      kind: { in: ["robux_username", "robux_login", "robux_gamepass", "premium"] },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: {
      id: true,
      code: true,
      kind: true,
      robuxAmount: true,
      robloxUsername: true,
      total: true,
      expressBadge: true,
      createdAt: true,
      events: { where: { state: "paid" }, orderBy: { at: "asc" }, take: 1, select: { at: true } },
    },
  });
  return rows.map((row) => {
    const paidAt = row.events[0]?.at ?? row.createdAt;
    const windowMs = poolHours * 3_600_000;
    const remainingMs = paidAt.getTime() + windowMs - now;
    return {
      id: row.id,
      code: row.code,
      kind: row.kind,
      kindLabel: poolKindLabel(row.kind),
      robuxAmount: row.robuxAmount,
      robloxUsername: row.robloxUsername,
      total: row.total,
      expressBadge: row.expressBadge,
      createdAt: row.createdAt.toISOString(),
      claimSecondsLeft: Math.max(0, Math.floor(remainingMs / 1000)),
      claimable: remainingMs > 0,
    };
  });
}

/** Full order history for a seller's store (all statuses, newest first). */
export async function getSellerOrderHistory(
  sellerId: string,
  viewerUserId: string,
): Promise<{
  orders: OrderListItem[];
  heldTotal: number;
  activeCount: number;
  lifetimeTotal: number;
  completedCount: number;
}> {
  const now = Date.now();
  const rows = await db.order.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: ROOM_INCLUDE,
  });
  const summary = summarizeOrders(rows, now, viewerUserId);
  return {
    ...summary,
    completedCount: summary.orders.filter((order) => order.state === "completed").length,
  };
}

/** Seller's active orders for the dashboard strip. */
export async function getSellerActiveOrders(
  sellerId: string,
  viewerUserId: string,
): Promise<OrderListItem[]> {
  const now = Date.now();
  const rows = await db.order.findMany({
    where: { sellerId, status: { in: [...ACTIVE_ORDER_STATES] } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      product: { select: { title: true, slug: true, category: { select: { slug: true, name: true, slaMinutes: true, fulfillment: true } } } },
      seller: { select: { storeName: true, storeImage: true } },
      events: { orderBy: { at: "asc" } },
      messages: { select: { fromRole: true, at: true }, orderBy: { at: "asc" } },
      dispute: { select: { id: true } },
      payment: { select: { expiresAt: true, status: true } },
    },
  });
  return rows.map((row) => toListItem(row, now, unreadFor(row, viewerUserId)));
}
