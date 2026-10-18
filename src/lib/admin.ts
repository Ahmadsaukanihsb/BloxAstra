import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { DECIDABLE_DISPUTE_STATES, ESCROW_ORDER_STATES } from "@/lib/order-meta";
import {
  ADMIN_PAGE_SIZE,
  ADMIN_PREVIEW_SIZE,
  KYC_SCOPES,
  ORDER_SCOPES,
  USER_SCOPES,
  WD_SCOPES,
  cleanQuery,
  pager,
  type AdminKind,
  type KycScope,
  type OrderScope,
  type Pager,
  type SearchQuery,
  type UserScope,
  type WdScope,
} from "@/lib/admin-search";
import type { OrderState } from "@/lib/types";

export interface AdminDisputeRow {
  orderId: string;
  code: string;
  state: OrderState;
  total: number;
  platformFee: number;
  productTitle: string;
  productSlug: string;
  sellerStoreName: string;
  dispute: {
    ref: string;
    reasonId: string;
    reasonLabel: string;
    buyerNote: string;
    sellerReply: string;
    evidence: string[];
    slaHoursLeft: number;
    openedAt: string;
    status: string;
  };
}

export interface AdminEscrowRow {
  orderId: string;
  code: string;
  state: OrderState;
  total: number;
  productTitle: string;
  productSlug: string;
  sellerStoreName: string;
  waitingArbitration: boolean;
}

export interface AdminAuditRow {
  id: string;
  actionType: string;
  targetResource: string;
  targetId: string;
  diffPayload: string;
  ipAddress: string;
  actor: string;
  createdAt: string;
}

export interface AdminWithdrawalRow {
  id: string;
  ref: string;
  amount: number;
  fee: number;
  bank: string;
  accountNumber: string;
  storeName: string;
  /** pending | paid | rejected — the queue only shows pending, the search shows all */
  status: string;
  createdAt: string;
}

export interface AdminDashboard {
  adminName: string;
  adminEmail: string;
  /** uncapped server-side totals — header stats never under-report */
  heldTotal: number;
  escrowCount: number;
  openDisputeCount: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalTotal: number;
  /** uncapped audit-log size — the trail list only carries its most recent page */
  auditTotal: number;
  openDisputes: AdminDisputeRow[];
  escrowOrders: AdminEscrowRow[];
  pendingWithdrawals: AdminWithdrawalRow[];
  auditLogs: AdminAuditRow[];
}

// Escrow states come from `order-meta.ts`, the same list the escrow and refund
// logic runs on. This file used to keep its own copy, which is exactly how a
// queue ends up showing a different set of orders than the sweep touches.
const ESCROW_STATES = ESCROW_ORDER_STATES;

/**
 * Every dispute still waiting for a decision, and nothing else.
 *
 * The panel used to ask for `status: "open"` alone, which meant the moment the
 * seller replied the case left the queue — the stat card read "0 disputes" and
 * the admin saw "queue clean" while the money stayed frozen and un-decidable.
 * `DECIDABLE_DISPUTE_STATES` is the single list of live dispute states.
 *
 * The order-status condition lives in the query rather than in a `.filter()`
 * after `take:`: filtering after the limit silently drops rows, and the count
 * and the list would then be answering two different questions.
 */
const DECIDABLE_DISPUTE_WHERE: Prisma.DisputeWhereInput = {
  status: { in: [...DECIDABLE_DISPUTE_STATES] },
  order: { is: { status: "disputed" } },
};

function parseEvidence(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* fall through */
  }
  return [];
}

/** Admin dashboard data: open disputes, escrow-held orders, audit log tail. */
export async function getAdminDashboard(): Promise<AdminDashboard> {
  const [disputeRows, escrowRows, withdrawalRows, auditRows, totals] = await Promise.all([
    db.dispute.findMany({
      where: DECIDABLE_DISPUTE_WHERE,
      orderBy: { openedAt: "desc" },
      take: 20,
      include: {
        order: {
          select: {
            id: true,
            code: true,
            status: true,
            total: true,
            platformFee: true,
            product: { select: { title: true, slug: true } },
            seller: { select: { storeName: true } },
          },
        },
      },
    }),
    db.order.findMany({
      where: { status: { in: ESCROW_STATES } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        code: true,
        status: true,
        total: true,
        product: { select: { title: true, slug: true } },
        seller: { select: { storeName: true } },
      },
    }),
    db.withdrawal.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 30,
      select: {
        id: true,
        ref: true,
        amount: true,
        fee: true,
        bank: true,
        accountNumber: true,
        status: true,
        createdAt: true,
        seller: { select: { storeName: true } },
      },
    }),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    (async () => {
      const [escrowAgg, escrowCount, openDisputeCount, pendingWd, auditTotal] = await Promise.all([
        db.order.aggregate({
          where: { status: { in: ESCROW_STATES } },
          _sum: { total: true },
        }),
        db.order.count({ where: { status: { in: ESCROW_STATES } } }),
        db.dispute.count({ where: DECIDABLE_DISPUTE_WHERE }),
        db.withdrawal.aggregate({
          where: { status: "pending" },
          _sum: { amount: true },
          _count: true,
        }),
        db.adminAuditLog.count(),
      ]);
      return {
        heldTotal: escrowAgg._sum.total ?? 0,
        escrowCount,
        openDisputeCount,
        pendingWithdrawalCount: pendingWd._count,
        pendingWithdrawalTotal: pendingWd._sum.amount ?? 0,
        auditTotal,
      };
    })(),
  ]);

  // No filter here: `DECIDABLE_DISPUTE_WHERE` already pins the order status, so
  // what arrived is exactly what the panel shows and counts.
  const openDisputes: AdminDisputeRow[] = disputeRows.map((row) => ({
      orderId: row.order.id,
      code: row.order.code,
      state: row.order.status as OrderState,
      total: row.order.total,
      platformFee: row.order.platformFee,
      productTitle: row.order.product?.title ?? "—",
      productSlug: row.order.product?.slug ?? "",
      sellerStoreName: row.order.seller?.storeName ?? "—",
      dispute: {
        ref: row.ref,
        reasonId: row.reasonId,
        reasonLabel: row.reasonLabel,
        buyerNote: row.buyerNote,
        sellerReply: row.sellerReply,
        evidence: parseEvidence(row.evidence),
        slaHoursLeft: row.slaHoursLeft,
        openedAt: row.openedAt.toISOString(),
        status: row.status,
      },
    }));

  const escrowOrders: AdminEscrowRow[] = escrowRows.map((row) => ({
    orderId: row.id,
    code: row.code,
    state: row.status as OrderState,
    total: row.total,
    productTitle: row.product?.title ?? "—",
    productSlug: row.product?.slug ?? "",
    sellerStoreName: row.seller?.storeName ?? "—",
    waitingArbitration: row.status === "disputed",
  }));

  const pendingWithdrawals: AdminWithdrawalRow[] = withdrawalRows.map((row) => ({
    id: row.id,
    ref: row.ref,
    amount: row.amount,
    fee: row.fee,
    bank: row.bank,
    accountNumber: row.accountNumber,
    storeName: row.seller.storeName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));

  const auditLogs: AdminAuditRow[] = auditRows.map((row) => ({
    id: row.id,
    actionType: row.actionType,
    targetResource: row.targetResource,
    targetId: row.targetId,
    diffPayload: row.diffPayload,
    ipAddress: row.ipAddress,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    adminName: "",
    adminEmail: "",
    heldTotal: totals.heldTotal,
    escrowCount: totals.escrowCount,
    openDisputeCount: totals.openDisputeCount,
    pendingWithdrawalCount: totals.pendingWithdrawalCount,
    pendingWithdrawalTotal: totals.pendingWithdrawalTotal,
    auditTotal: totals.auditTotal,
    openDisputes,
    escrowOrders,
    pendingWithdrawals,
    auditLogs,
  };
}

/* ─────────────────────────────── pencarian ─────────────────────────────── */

/**
 * The one surface where a single order, user, withdrawal, or audit entry can be
 * found by looking for it.
 *
 * Every queue on /admin is a read-optimised preview with a fixed `take:` — the
 * dashboard used to hand those previews out as if they were the whole queue.
 * Each of them now links here when it is showing fewer rows than it holds, and
 * this is where the rest of the rows live, twenty at a time with an honest
 * total.
 *
 * Search is matched with SQL `LIKE '%q%'`, which is case-insensitive for ASCII
 * on SQLite — the dev and production driver here — so "vault" finds
 * "VaultNusantara" without a collation hack. Order codes and withdrawal refs
 * are matched upper-cased as well, because they are stored that way and an
 * admin typing "bx-9f0c18" should not have to know it.
 */

export interface AdminSearchOrderRow {
  code: string;
  status: OrderState;
  kind: string;
  total: number;
  robuxAmount: number | null;
  robloxUsername: string | null;
  createdAt: string;
  productTitle: string | null;
  buyerUsername: string;
  buyerEmail: string;
  sellerStoreName: string | null;
}

export interface AdminSearchUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  kycStatus: string;
  whatsapp: string | null;
  whatsappVerified: boolean;
  joinedAt: string;
  storeName: string | null;
  tier: number | null;
  /** orders this user placed as a buyer */
  orderCount: number;
  suspended: boolean;
  suspendReason: string | null;
}

export interface AdminSearchSection<T> {
  rows: T[];
  pager: Pager;
}

export interface AdminSearchResult {
  q: string;
  kind: AdminKind;
  /** null when this kind was not requested */
  orders: AdminSearchSection<AdminSearchOrderRow> | null;
  users: AdminSearchSection<AdminSearchUserRow> | null;
  withdrawals: AdminSearchSection<AdminWithdrawalRow> | null;
  audit: AdminSearchSection<AdminAuditRow> | null;
}

function orderWhere(q: string, scope: OrderScope): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const states = ORDER_SCOPES.find((entry) => entry.id === scope)?.states;
  if (states) where.status = { in: states };
  if (q) {
    const upper = q.toUpperCase();
    where.OR = [
      { code: { contains: upper } },
      { robloxUsername: { contains: q } },
      { buyer: { is: { username: { contains: q } } } },
      { buyer: { is: { email: { contains: q } } } },
      { product: { is: { title: { contains: q } } } },
      { seller: { is: { storeName: { contains: q } } } },
    ];
  }
  return where;
}

function userWhere(q: string, role: string | null, kyc: string | null): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role;
  if (kyc) where.kycStatus = kyc;
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { email: { contains: q } },
      { whatsapp: { contains: q } },
      { sellerProfile: { is: { storeName: { contains: q } } } },
    ];
  }
  return where;
}

function withdrawalWhere(q: string, status: string | null): Prisma.WithdrawalWhereInput {
  const where: Prisma.WithdrawalWhereInput = {};
  if (status) where.status = status;
  if (q) {
    const upper = q.toUpperCase();
    where.OR = [
      { ref: { contains: upper } },
      { bank: { contains: q } },
      { accountNumber: { contains: q } },
      { seller: { is: { storeName: { contains: q } } } },
    ];
  }
  return where;
}

function auditWhere(q: string): Prisma.AdminAuditLogWhereInput {
  if (!q) return {};
  return {
    OR: [
      { actionType: { contains: q } },
      { actor: { contains: q } },
      { targetResource: { contains: q } },
      { targetId: { contains: q } },
      { ipAddress: { contains: q } },
    ],
  };
}

async function loadOrders(
  q: string,
  scope: OrderScope,
  page: number,
  perPage: number,
): Promise<AdminSearchSection<AdminSearchOrderRow>> {
  const where = orderWhere(q, scope);
  const total = await db.order.count({ where });
  const current = pager(total, page, perPage);
  const rows = await db.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: current.offset,
    take: current.perPage,
    select: {
      code: true,
      status: true,
      kind: true,
      total: true,
      robuxAmount: true,
      robloxUsername: true,
      createdAt: true,
      product: { select: { title: true } },
      buyer: { select: { username: true, email: true } },
      seller: { select: { storeName: true } },
    },
  });
  return {
    pager: current,
    rows: rows.map((row) => ({
      code: row.code,
      status: row.status as OrderState,
      kind: row.kind,
      total: row.total,
      robuxAmount: row.robuxAmount,
      robloxUsername: row.robloxUsername,
      createdAt: row.createdAt.toISOString(),
      productTitle: row.product?.title ?? null,
      buyerUsername: row.buyer.username,
      buyerEmail: row.buyer.email,
      sellerStoreName: row.seller?.storeName ?? null,
    })),
  };
}

async function loadUsers(
  q: string,
  userScope: UserScope,
  kycScope: KycScope,
  page: number,
  perPage: number,
): Promise<AdminSearchSection<AdminSearchUserRow>> {
  const role = USER_SCOPES.find((entry) => entry.id === userScope)?.role ?? null;
  const kyc = KYC_SCOPES.find((entry) => entry.id === kycScope)?.value ?? null;
  const where = userWhere(q, role, kyc);
  const total = await db.user.count({ where });
  const current = pager(total, page, perPage);
  const rows = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: current.offset,
    take: current.perPage,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      kycStatus: true,
      whatsapp: true,
      whatsappVerified: true,
      createdAt: true,
      suspendedAt: true,
      suspendReason: true,
      sellerProfile: { select: { storeName: true, tier: true } },
      _count: { select: { buyerOrders: true } },
    },
  });
  return {
    pager: current,
    rows: rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      kycStatus: row.kycStatus,
      whatsapp: row.whatsapp,
      whatsappVerified: row.whatsappVerified,
      joinedAt: row.createdAt.toISOString(),
      storeName: row.sellerProfile?.storeName ?? null,
      tier: row.sellerProfile?.tier ?? null,
      orderCount: row._count.buyerOrders,
      suspended: row.suspendedAt !== null,
      suspendReason: row.suspendReason,
    })),
  };
}

async function loadWithdrawals(
  q: string,
  wdScope: WdScope,
  page: number,
  perPage: number,
): Promise<AdminSearchSection<AdminWithdrawalRow>> {
  const status = WD_SCOPES.find((entry) => entry.id === wdScope)?.value ?? null;
  const where = withdrawalWhere(q, status);
  const total = await db.withdrawal.count({ where });
  const current = pager(total, page, perPage);
  const rows = await db.withdrawal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: current.offset,
    take: current.perPage,
    select: {
      id: true,
      ref: true,
      amount: true,
      fee: true,
      bank: true,
      accountNumber: true,
      status: true,
      createdAt: true,
      seller: { select: { storeName: true } },
    },
  });
  return {
    pager: current,
    rows: rows.map((row) => ({
      id: row.id,
      ref: row.ref,
      amount: row.amount,
      fee: row.fee,
      bank: row.bank,
      accountNumber: row.accountNumber,
      storeName: row.seller.storeName,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

async function loadAudit(
  q: string,
  page: number,
  perPage: number,
): Promise<AdminSearchSection<AdminAuditRow>> {
  const where = auditWhere(q);
  const total = await db.adminAuditLog.count({ where });
  const current = pager(total, page, perPage);
  const rows = await db.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: current.offset,
    take: current.perPage,
  });
  return {
    pager: current,
    rows: rows.map((row) => ({
      id: row.id,
      actionType: row.actionType,
      targetResource: row.targetResource,
      targetId: row.targetId,
      diffPayload: row.diffPayload,
      ipAddress: row.ipAddress,
      actor: row.actor,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

/* ─────────────────────── moderasi ulasan ─────────────────────── */

export interface AdminReviewRow {
  id: string;
  orderCode: string;
  rating: number;
  comment: string;
  hidden: boolean;
  createdAt: string;
  buyerName: string;
  productTitle: string | null;
  sellerStoreName: string | null;
}

/**
 * Newest reviews first — the surface for hiding abusive or fake-looking
 * comments. Hidden rows stay visible here (marked) so the decision can be
 * reversed; public surfaces never see them.
 */
export async function getAdminReviews(): Promise<AdminReviewRow[]> {
  const rows = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      rating: true,
      comment: true,
      hidden: true,
      createdAt: true,
      buyer: { select: { username: true } },
      product: { select: { title: true } },
      seller: { select: { storeName: true } },
      order: { select: { code: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    orderCode: row.order.code,
    rating: row.rating,
    comment: row.comment,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    buyerName: row.buyer.username,
    productTitle: row.product?.title ?? null,
    sellerStoreName: row.seller?.storeName ?? null,
  }));
}

/* ─────────────────────── antrean KYC ─────────────────────── */

export interface AdminKycRow {
  userId: string;
  username: string;
  email: string;
  whatsapp: string | null;
  joinedAt: string;
  storeName: string | null;
  tier: number | null;
  fullName: string | null;
  idCardImage: string | null;
  selfieImage: string | null;
}

/**
 * Pending seller KYC applications (oldest first — the longest wait gets
 * decided first) plus the real backlog size, which is larger than the
 * 20 rows the queue carries.
 */
export async function getKycQueue(): Promise<{ rows: AdminKycRow[]; total: number }> {
  const [total, users] = await Promise.all([
    db.user.count({ where: { kycStatus: "pending" } }),
    db.user.findMany({
      where: { kycStatus: "pending" },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        whatsapp: true,
        createdAt: true,
        sellerProfile: {
          select: {
            storeName: true,
            tier: true,
            fullName: true,
            idCardImage: true,
            selfieImage: true,
          },
        },
      },
    }),
  ]);
  return {
    total,
    rows: users.map((row) => ({
      userId: row.id,
      username: row.username,
      email: row.email,
      whatsapp: row.whatsapp,
      joinedAt: row.createdAt.toISOString(),
      storeName: row.sellerProfile?.storeName ?? null,
      tier: row.sellerProfile?.tier ?? null,
      fullName: row.sellerProfile?.fullName ?? null,
      idCardImage: row.sellerProfile?.idCardImage ?? null,
      selfieImage: row.sellerProfile?.selfieImage ?? null,
    })),
  };
}

/* ─────────────────────── moderasi pengguna ─────────────────────── */

export interface AdminUserRow {
  id: string;
  username: string;
  email: string;
  role: string;
  kycStatus: string;
  suspended: boolean;
  suspendReason: string | null;
  storeName: string | null;
  orderCount: number;
  joinedAt: string;
}

/**
 * Newest accounts first, suspended ones pinned at the top so a second
 * admin immediately sees what is already locked. Links out to the full
 * search for anything older.
 */
export async function getAdminUsers(): Promise<{ rows: AdminUserRow[]; suspendedCount: number }> {
  const [rows, suspendedCount] = await Promise.all([
    db.user.findMany({
      orderBy: [{ suspendedAt: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        kycStatus: true,
        suspendedAt: true,
        suspendReason: true,
        createdAt: true,
        sellerProfile: { select: { storeName: true } },
        _count: { select: { buyerOrders: true } },
      },
    }),
    db.user.count({ where: { suspendedAt: { not: null } } }),
  ]);
  // SQLite sorts NULLS first on DESC — suspended rows float up either way,
  // but make it explicit so Postgres (NULLS LAST on DESC) behaves the same.
  const sorted = [...rows].sort(
    (a, b) => Number(b.suspendedAt !== null) - Number(a.suspendedAt !== null),
  );
  return {
    suspendedCount,
    rows: sorted.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role: row.role,
      kycStatus: row.kycStatus,
      suspended: row.suspendedAt !== null,
      suspendReason: row.suspendReason,
      storeName: row.sellerProfile?.storeName ?? null,
      orderCount: row._count.buyerOrders,
      joinedAt: row.createdAt.toISOString(),
    })),
  };
}

/* ─────────────────────── moderasi & operasi ─────────────────────── */

export interface AdminProductRow {
  id: string;
  slug: string;
  title: string;
  game: string;
  price: number;
  stock: number;
  sold: number;
  isListed: boolean;
  featured: boolean;
  deliveryKind: string;
  sellerStoreName: string;
  /** Seller upload (data URL) or admin-set https URL; null = generative art. */
  imageUrl: string | null;
}

/** Newest listings first — the surface for takedown / feature decisions. */
export async function getAdminProducts(): Promise<AdminProductRow[]> {
  const rows = await db.product.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      slug: true,
      title: true,
      game: true,
      price: true,
      stock: true,
      sold: true,
      isListed: true,
      featured: true,
      deliveryKind: true,
      imageUrl: true,
      seller: { select: { storeName: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    game: row.game,
    price: row.price,
    stock: row.stock,
    sold: row.sold,
    isListed: row.isListed,
    featured: row.featured,
    deliveryKind: row.deliveryKind,
    sellerStoreName: row.seller.storeName,
    imageUrl: row.imageUrl,
  }));
}

export interface AdminPromoRow {
  code: string;
  type: string;
  value: number;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  note: string | null;
}

/** Every promo code with its redemption budget usage. */
export async function getAdminPromos(): Promise<AdminPromoRow[]> {
  const rows = await db.promoCode.findMany({ orderBy: { code: "asc" } });
  return rows.map((row) => ({
    code: row.code,
    type: row.type,
    value: row.value,
    active: row.active,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    note: row.note,
  }));
}

export interface AdminTopUpRow {
  code: string;
  username: string;
  amount: number;
  fee: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
}

/** Top-ups still needing money movement, newest first — the manual-credit queue. */
export async function getAdminTopUps(): Promise<{ rows: AdminTopUpRow[]; pendingCount: number }> {
  const [rows, pendingCount] = await Promise.all([
    db.topUp.findMany({
      where: { status: { in: ["pending", "failed", "expired"] }, creditedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        code: true,
        amount: true,
        fee: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { username: true } },
      },
    }),
    db.topUp.count({ where: { status: "pending", creditedAt: null } }),
  ]);
  return {
    rows: rows.map((row) => ({
      code: row.code,
      username: row.user.username,
      amount: row.amount,
      fee: row.fee,
      paymentMethod: row.paymentMethod,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
    })),
    pendingCount,
  };
}

export interface ChatReportRow {
  id: string;
  reason: string;
  createdAt: string;
  reporterName: string;
  messageId: string;
  messageBody: string;
  messageDeleted: boolean;
  authorName: string;
}

/** Open seller-chat reports with both sides' names for a one-glance decision. */
export async function getChatReports(): Promise<ChatReportRow[]> {
  const rows = await db.sellerChatReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      reason: true,
      createdAt: true,
      reporter: {
        select: { username: true, sellerProfile: { select: { storeName: true } } },
      },
      message: {
        select: {
          id: true,
          body: true,
          deletedAt: true,
          user: {
            select: { username: true, sellerProfile: { select: { storeName: true } } },
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    reporterName: row.reporter.sellerProfile?.storeName ?? row.reporter.username,
    messageId: row.message.id,
    messageBody: row.message.body,
    messageDeleted: row.message.deletedAt !== null,
    authorName: row.message.user.sellerProfile?.storeName ?? row.message.user.username,
  }));
}

/**
 * Search one kind with real paging, or all four at a preview size. Queried in
 * parallel: the four sections are independent, and two sequential round trips
 * (count, then the page it clamps to) per section is the price of never showing
 * a page that does not exist.
 */
export async function searchAdmin(query: SearchQuery): Promise<AdminSearchResult> {
  const q = cleanQuery(query.q);
  const previewingAll = query.kind === "semua";
  const perPage = previewingAll ? ADMIN_PREVIEW_SIZE : ADMIN_PAGE_SIZE;
  const wants = (kind: AdminKind) => previewingAll || query.kind === kind;

  const [orders, users, withdrawals, audit] = await Promise.all([
    wants("pesanan") ? loadOrders(q, query.orderScope, query.page, perPage) : null,
    wants("pengguna") ? loadUsers(q, query.userScope, query.kycScope, query.page, perPage) : null,
    wants("penarikan") ? loadWithdrawals(q, query.wdScope, query.page, perPage) : null,
    wants("audit") ? loadAudit(q, query.page, perPage) : null,
  ]);

  return { q, kind: query.kind, orders, users, withdrawals, audit };
}
