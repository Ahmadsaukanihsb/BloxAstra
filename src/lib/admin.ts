import "server-only";
import { db } from "@/lib/db";
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
  openDisputes: AdminDisputeRow[];
  escrowOrders: AdminEscrowRow[];
  pendingWithdrawals: AdminWithdrawalRow[];
  auditLogs: AdminAuditRow[];
}

const ESCROW_STATES = ["paid", "processing", "shipped", "disputed"];

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
      where: { status: "open" },
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
        createdAt: true,
        seller: { select: { storeName: true } },
      },
    }),
    db.adminAuditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    (async () => {
      const [escrowAgg, escrowCount, openDisputeCount, pendingWd] = await Promise.all([
        db.order.aggregate({
          where: { status: { in: ESCROW_STATES } },
          _sum: { total: true },
        }),
        db.order.count({ where: { status: { in: ESCROW_STATES } } }),
        db.dispute.count({ where: { status: "open" } }),
        db.withdrawal.aggregate({
          where: { status: "pending" },
          _sum: { amount: true },
          _count: true,
        }),
      ]);
      return {
        heldTotal: escrowAgg._sum.total ?? 0,
        escrowCount,
        openDisputeCount,
        pendingWithdrawalCount: pendingWd._count,
        pendingWithdrawalTotal: pendingWd._sum.amount ?? 0,
      };
    })(),
  ]);

  const openDisputes: AdminDisputeRow[] = disputeRows
    .filter((row) => row.order.status === "disputed")
    .map((row) => ({
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
    openDisputes,
    escrowOrders,
    pendingWithdrawals,
    auditLogs,
  };
}
