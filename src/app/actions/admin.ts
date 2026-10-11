"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/notifications";

export type AdminActionResult = { ok: true } | { ok: false; error: string };

const CODE_PATTERN = /^BX-[A-Z0-9]{6}$/;

const resolveSchema = z.object({
  orderCode: z.string().regex(CODE_PATTERN),
  outcome: z.enum(["refund", "release"]),
});

const releaseSchema = z.object({
  orderCode: z.string().regex(CODE_PATTERN),
});

const rateUpdateSchema = z.object({
  cover: z.number().positive(),
  noCover: z.number().positive(),
  // Percent inputs (divided by 100 before storage) — capped so a typo can
  // never zero out every price on the platform.
  vol2000: z.number().min(0).max(30),
  vol5000: z.number().min(0).max(30),
  vol10000: z.number().min(0).max(30),
  orderUsername: z.number().positive(),
  orderLogin: z.number().positive(),
  orderGamepass: z.number().positive(),
  orderPremium: z.number().positive(),
  adminFee: z.number().positive(),
});

function fail(error: string): AdminActionResult {
  return { ok: false, error };
}

class AbortTxError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

function isUniqueCollision(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}

async function appendLedger(
  tx: import("@prisma/client").Prisma.TransactionClient,
  data: {
    userId: string;
    sellerId?: string | null;
    type: string;
    amount: number;
    note: string;
    orderCode?: string;
  },
) {
  const aggregate = await tx.walletLedger.aggregate({
    where: { userId: data.userId },
    _sum: { amount: true },
  });
  const balanceAfter = (aggregate._sum.amount ?? 0) + data.amount;
  return tx.walletLedger.create({
    data: {
      userId: data.userId,
      sellerId: data.sellerId ?? null,
      type: data.type,
      amount: data.amount,
      balanceAfter,
      note: data.note,
      orderCode: data.orderCode ?? null,
    },
  });
}

/** Resolve a dispute: refund buyer or release to seller. Always writes AdminAuditLog. */
export async function resolveDispute(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = resolveSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const { orderCode, outcome } = parsed.data;
  const order = await db.order.findUnique({
    where: { code: orderCode },
    include: {
      dispute: { select: { id: true, ref: true } },
      buyer: { select: { id: true } },
      seller: { select: { id: true, userId: true } },
    },
  });
  if (!order) return fail("Pesanan tidak ditemukan.");
  if (order.status !== "disputed") return fail("Pesanan tidak dalam status disputed.");
  const disputeId = order.dispute?.id;
  if (!disputeId) return fail("Sengketa tidak ditemukan.");

  const sellerEarning = order.total - order.platformFee;
  const ip = await clientIp();

  try {
    await db.$transaction(async (tx) => {
      const alreadyHandled = await tx.dispute.findUnique({
        where: { id: disputeId },
        select: { status: true },
      });
      if (alreadyHandled && alreadyHandled.status !== "open") {
        throw new AbortTxError("Sengketa ini sudah diselesaikan sebelumnya.");
      }

      if (outcome === "refund") {
        const alreadyRefunded = await tx.walletLedger.findFirst({
          where: { orderCode, type: "refund" },
          select: { id: true },
        });
        if (alreadyRefunded) {
          throw new AbortTxError("Refund untuk order ini sudah pernah dilakukan.");
        }

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "disputed" },
          data: { status: "refunded" },
        });
        if (updated.count === 0) {
          throw new AbortTxError("Pesanan tidak dalam status disputed.");
        }
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "refunded",
            label: "Sengketa diterima, refund penuh ke pembeli",
            actor: "admin",
          },
        });
        if (order.productId) {
          await tx.product.update({
            where: { id: order.productId },
            data: { stock: { increment: order.quantity } },
          });
          // Sold was +1'd at ship time — unwind it only if this order actually
          // shipped, otherwise the bestseller counter drifts negative.
          const shipped = await tx.orderEvent.findFirst({
            where: { orderId: order.id, state: "shipped" },
            select: { id: true },
          });
          if (shipped) {
            await tx.product.update({
              where: { id: order.productId },
              data: { sold: { decrement: order.quantity } },
            });
          }
        }
        await appendLedger(tx, {
          userId: order.buyer.id,
          type: "refund",
          amount: order.total,
          note: `Refund sengketa ${orderCode}`,
          orderCode,
        });
        updateTag("catalog");
      } else {
        const alreadyPaid = await tx.walletLedger.findFirst({
          where: { orderCode, type: "earning" },
          select: { id: true },
        });
        if (alreadyPaid) {
          throw new AbortTxError("Dana order ini sudah pernah dicairkan.");
        }

        const updated = await tx.order.updateMany({
          where: { id: order.id, status: "disputed" },
          data: { status: "completed" },
        });
        if (updated.count === 0) {
          throw new AbortTxError("Pesanan tidak dalam status disputed.");
        }
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            state: "completed",
            label: "Sengketa ditolak, dana dicairkan ke penjual",
            actor: "admin",
          },
        });
        if (order.seller) {
          await tx.sellerProfile.update({
            where: { id: order.seller.id },
            data: { ordersCompleted: { increment: 1 } },
          });
          await appendLedger(tx, {
            userId: order.seller.userId,
            sellerId: order.seller.id,
            type: "earning",
            amount: sellerEarning,
            note: `Pencairan sengketa ${orderCode}`,
            orderCode,
          });
        }
      }
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: outcome === "refund" ? "resolved_refund" : "resolved_release",
          resolvedAt: new Date(),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actionType: "dispute.resolve",
          targetResource: "orders",
          targetId: order.id,
          diffPayload: JSON.stringify({
            orderCode,
            outcome,
            amount: outcome === "refund" ? order.total : sellerEarning,
          }),
          ipAddress: ip,
          actor: user.email,
        },
      });
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.reason);
    if (isUniqueCollision(err)) return fail("Dana order ini sudah pernah dicairkan.");
    throw err;
  }

  revalidatePath("/admin");
  revalidatePath(`/pesanan/${orderCode}`);
  await notify({
    userId: order.buyer.id,
    kind: "dispute_resolved",
    title:
      outcome === "refund"
        ? `Sengketa ${orderCode} dimenangkan. Refund masuk`
        : `Sengketa ${orderCode} ditolak. Dana dilepas ke penjual`,
    body:
      outcome === "refund"
        ? "Dana dikembalikan penuh sebagai saldo akun."
        : "Admin memutuskan dana layak dicairkan ke penjual.",
    link: `/pesanan/${orderCode}`,
  });
  if (order.seller) {
    await notify({
      userId: order.seller.userId,
      kind: "dispute_resolved",
      title:
        outcome === "refund"
          ? `Sengketa ${orderCode} dimenangkan pembeli`
          : `Sengketa ${orderCode} ditolak. Dana cair`,
      body:
        outcome === "refund"
          ? "Dana dikembalikan ke pembeli."
          : "Dana dicairkan ke dompetmu.",
      link: `/pesanan/${orderCode}`,
    });
  }
  return { ok: true };
}

/** Manual escrow release for a paid/processing/shipped order. */
export async function releaseEscrow(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = releaseSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const { orderCode } = parsed.data;
  const order = await db.order.findUnique({
    where: { code: orderCode },
    include: { seller: { select: { id: true, userId: true } } },
  });
  if (!order) return fail("Pesanan tidak ditemukan.");
  if (!["paid", "processing", "shipped"].includes(order.status)) {
    return fail("Payout manual hanya untuk status paid, processing, atau shipped.");
  }
  if (!order.seller) return fail("Pesanan belum punya penjual.");

  const sellerEarning = order.total - order.platformFee;
  const ip = await clientIp();

  try {
    await db.$transaction(async (tx) => {
      const alreadyPaid = await tx.walletLedger.findFirst({
        where: { orderCode, type: "earning" },
        select: { id: true },
      });
      if (alreadyPaid) {
        throw new AbortTxError("Dana order ini sudah pernah dicairkan.");
      }

      const updated = await tx.order.updateMany({
        where: { id: order.id, status: { in: ["paid", "processing", "shipped"] } },
        data: { status: "completed", autoReleaseAt: null },
      });
      if (updated.count === 0) {
        throw new AbortTxError("Pesanan tidak dalam status yang bisa di-payout.");
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          state: "completed",
          label: "Admin mengeksekusi manual payout",
          actor: "admin",
        },
      });
      await tx.sellerProfile.update({
        where: { id: order.seller!.id },
        data: { ordersCompleted: { increment: 1 } },
      });
      await appendLedger(tx, {
        userId: order.seller!.userId,
        sellerId: order.seller!.id,
        type: "earning",
        amount: sellerEarning,
        note: `Manual payout ${orderCode}`,
        orderCode,
      });
      await tx.adminAuditLog.create({
        data: {
          actionType: "escrow.release",
          targetResource: "wallets",
          targetId: order.id,
          diffPayload: JSON.stringify({ orderCode, amount: sellerEarning, payout: "manual" }),
          ipAddress: ip,
          actor: user.email,
        },
      });
    });
  } catch (err) {
    if (err instanceof AbortTxError) return fail(err.reason);
    if (isUniqueCollision(err)) return fail("Dana order ini sudah pernah dicairkan.");
    throw err;
  }

  revalidatePath("/admin");
  revalidatePath(`/pesanan/${orderCode}`);
  await notify({
    userId: order.seller.userId,
    kind: "order_completed",
    title: `Admin mencairkan dana ${orderCode}`,
    body: "Pencairan manual: dana masuk ke dompetmu.",
    link: `/pesanan/${orderCode}`,
  });
  return { ok: true };
}

/** Publish a new active rate card (deactivates the previous one). */
export async function updateRateCard(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = rateUpdateSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input rate tidak valid.");

  const d = parsed.data;
  const previous = await db.rateCard.findFirst({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
  });
  const ip = await clientIp();

  await db.$transaction(async (tx) => {
    if (previous) {
      await tx.rateCard.update({ where: { id: previous.id }, data: { active: false } });
    }
    await tx.rateCard.create({
      data: {
        active: true,
        cover: d.cover,
        noCover: d.noCover,
        vol2000: d.vol2000 / 100,
        vol5000: d.vol5000 / 100,
        vol10000: d.vol10000 / 100,
        orderUsername: d.orderUsername,
        orderLogin: d.orderLogin,
        orderGamepass: d.orderGamepass,
        orderPremium: d.orderPremium,
        adminFee: d.adminFee,
        updatedBy: user.email,
      },
    });
    const diff: Record<string, string> = {};
    if (previous) {
      const pairs: [string, number, number][] = [
        ["cover", previous.cover, d.cover],
        ["no_cover", previous.noCover, d.noCover],
        ["volume_2000", previous.vol2000 * 100, d.vol2000],
        ["volume_5000", previous.vol5000 * 100, d.vol5000],
        ["volume_10000", previous.vol10000 * 100, d.vol10000],
        ["rate_username", previous.orderUsername, d.orderUsername],
        ["rate_login", previous.orderLogin, d.orderLogin],
        ["rate_gamepass", previous.orderGamepass, d.orderGamepass],
        ["rate_premium", previous.orderPremium, d.orderPremium],
        ["admin_fee", previous.adminFee, d.adminFee],
      ];
      for (const [key, before, after] of pairs) {
        if (before !== after) diff[key] = `${before} → ${after}`;
      }
    }
    await tx.adminAuditLog.create({
      data: {
        actionType: "rate.update",
        targetResource: "orders",
        targetId: "robux_rate_card",
        diffPayload: Object.keys(diff).length > 0 ? JSON.stringify(diff) : `{ note: "tidak ada perubahan" }`,
        ipAddress: ip,
        actor: user.email,
      },
    });
  });

  updateTag("rates");
  revalidatePath("/admin");
  return { ok: true };
}

/** Reset the rate card to the platform defaults. */
export async function resetRateCard(): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const { DEFAULT_RATE_CARD } = await import("@/lib/robux-pricing");
  const { DEFAULT_ORDER_RATES } = await import("@/lib/robux-orders");
  const ip = await clientIp();

  await db.$transaction(async (tx) => {
    const previous = await tx.rateCard.findFirst({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
    });
    if (previous) {
      await tx.rateCard.update({ where: { id: previous.id }, data: { active: false } });
    }
    await tx.rateCard.create({
      data: {
        active: true,
        cover: DEFAULT_RATE_CARD.cover,
        noCover: DEFAULT_RATE_CARD.noCover,
        vol2000: DEFAULT_RATE_CARD.volume.at2000,
        vol5000: DEFAULT_RATE_CARD.volume.at5000,
        vol10000: DEFAULT_RATE_CARD.volume.at10000,
        orderUsername: DEFAULT_ORDER_RATES.username,
        orderLogin: DEFAULT_ORDER_RATES.login,
        orderGamepass: DEFAULT_ORDER_RATES.gamepass,
        orderPremium: DEFAULT_ORDER_RATES.premium,
        adminFee: DEFAULT_ORDER_RATES.adminFee,
        updatedBy: user.email,
      },
    });
    await tx.adminAuditLog.create({
      data: {
        actionType: "rate.reset",
        targetResource: "orders",
        targetId: "robux_rate_card",
        diffPayload: `{ restored: "default_rate_card" }`,
        ipAddress: ip,
        actor: user.email,
      },
    });
  });

  updateTag("rates");
  revalidatePath("/admin");
  return { ok: true };
}

const kycApproveSchema = z.object({
  userId: z.string().min(1),
});

const kycRejectSchema = z.object({
  userId: z.string().min(1),
  reason: z.string().trim().min(3).max(300),
});

/**
 * Approve a seller's pending KYC. Guarded by kycStatus so double-clicks and
 * concurrent admins can never process the same review twice.
 */
export async function approveKyc(rawInput: unknown): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = kycApproveSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");
  const { userId } = parsed.data;
  const ip = await clientIp();

  const state = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        username: true,
        sellerProfile: { select: { storeName: true, idCardImage: true, selfieImage: true } },
      },
    });
    if (!target) return "missing" as const;
    // Legacy pendings from before document upload existed have no files —
    // approving them blind would defeat KYC. Reject and ask for re-upload.
    if (!target.sellerProfile?.idCardImage || !target.sellerProfile?.selfieImage) {
      return "nodoc" as const;
    }
    const updated = await tx.user.updateMany({
      where: { id: userId, kycStatus: "pending" },
      data: { kycStatus: "verified" },
    });
    if (updated.count === 0) return "stale" as const;
    await tx.sellerProfile.updateMany({
      where: { userId },
      data: { kycVerified: true, kycRejectReason: null },
    });
    await tx.adminAuditLog.create({
      data: {
        actionType: "kyc.approve",
        targetResource: "users",
        targetId: userId,
        diffPayload: `{ kyc_status: "pending → verified", username: "${target.username}", store: "${target.sellerProfile?.storeName ?? "-"}" }`,
        ipAddress: ip,
        actor: admin.email,
      },
    });
    return "done" as const;
  });

  if (state === "missing") return fail("Pengguna tidak ditemukan.");
  if (state === "stale") return fail("Status KYC ini sudah diproses sebelumnya.");
  if (state === "nodoc") {
    return fail("Berkas KYC tidak ada (pengajuan lama). Tolak dan minta penjual unggah ulang.");
  }
  await notify({
    userId,
    kind: "kyc_approved",
    title: "KYC tokomu disetujui",
    body: "Toko kini terverifikasi. Listing bisa dibuat, toko bisa dibuka, dan pool rebutan terbuka.",
    link: "/dashboard/penjual",
  });
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

/** Reject a seller's pending KYC with a recorded reason. */
export async function rejectKyc(rawInput: unknown): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = kycRejectSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  const { userId, reason } = parsed.data;
  const ip = await clientIp();

  const state = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: { username: true },
    });
    if (!target) return "missing" as const;
    const updated = await tx.user.updateMany({
      where: { id: userId, kycStatus: "pending" },
      data: { kycStatus: "rejected" },
    });
    if (updated.count === 0) return "stale" as const;
    await tx.sellerProfile.updateMany({
      where: { userId },
      data: { kycVerified: false, kycRejectReason: reason, isOnline: false, idCardImage: null, selfieImage: null },
    });
    await tx.adminAuditLog.create({
      data: {
        actionType: "kyc.reject",
        targetResource: "users",
        targetId: userId,
        diffPayload: `{ kyc_status: "pending → rejected", username: "${target.username}", reason: "${reason}" }`,
        ipAddress: ip,
        actor: admin.email,
      },
    });
    return "done" as const;
  });

  if (state === "missing") return fail("Pengguna tidak ditemukan.");
  if (state === "stale") return fail("Status KYC ini sudah diproses sebelumnya.");
  await notify({
    userId,
    kind: "kyc_rejected",
    title: "KYC tokomu ditolak",
    body: reason,
    link: "/dashboard/penjual",
  });
  revalidatePath("/dashboard/admin");
  return { ok: true };
}

const withdrawalRefSchema = z.string().regex(/^WD-[A-Z0-9]{4}$/, "Referensi penarikan tidak valid.");
const rejectionSchema = z.object({
  ref: z.string().regex(/^WD-[A-Z0-9]{4}$/),
  reason: z.string().trim().min(3).max(300),
});

/**
 * Approve a pending withdrawal. Balance was already deducted when the seller
 * requested it, so approval only flips the status (guarded so double-clicks and
 * concurrent admins can never process it twice).
 */
export async function approveWithdrawal(rawRef: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = withdrawalRefSchema.safeParse(rawRef);
  if (!parsed.success) return fail("Referensi penarikan tidak valid.");
  const ref = parsed.data;
  const ip = await clientIp();

  const state = await db.$transaction(async (tx) => {
    const w = await tx.withdrawal.findUnique({ where: { ref } });
    if (!w) {
      return "missing" as const;
    }
    const updated = await tx.withdrawal.updateMany({
      where: { id: w.id, status: "pending" },
      data: { status: "paid" },
    });
    if (updated.count === 0) {
      return "stale" as const;
    }
    await tx.adminAuditLog.create({
      data: {
        actionType: "withdrawal.approve",
        targetResource: "wallets",
        targetId: ref,
        diffPayload: `{ status: "pending → paid", amount: ${w.amount}, fee: ${w.fee}, bank: "${w.bank}" }`,
        ipAddress: ip,
        actor: user.email,
      },
    });
    return "done" as const;
  });

  if (state === "missing") return fail("Penarikan tidak ditemukan.");
  if (state === "stale") return fail("Penarikan ini sudah diproses sebelumnya.");
  const done = await db.withdrawal.findUnique({ where: { ref }, select: { userId: true, amount: true } });
  if (done) {
    await notify({
      userId: done.userId,
      kind: "withdrawal_decided",
      title: `Penarikan ${ref} disetujui`,
      body: `Dana ${done.amount} sedang ditransfer admin ke rekeningmu.`,
      link: "/dompet",
    });
  }
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Reject a pending withdrawal and return amount+fee to the seller's wallet.
 * The refund ledger entry is written inside the same guarded transaction, so a
 * retry can never double-credit the wallet.
 */
export async function rejectWithdrawal(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = rejectionSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  const { ref, reason } = parsed.data;
  const ip = await clientIp();

  let state: "missing" | "done" | "stale";
  try {
    state = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { ref } });
      if (!w) {
        return "missing" as const;
      }
      const updated = await tx.withdrawal.updateMany({
        where: { id: w.id, status: "pending" },
        data: { status: "rejected", note: reason },
      });
      if (updated.count === 0) {
        return "stale" as const;
      }
      await appendLedger(tx, {
        userId: w.userId,
        sellerId: w.sellerId,
        type: "refund",
        amount: w.amount + w.fee,
        note: `Penarikan ${ref} ditolak. Dana dikembalikan. Alasan: ${reason}`,
      });
      await tx.adminAuditLog.create({
        data: {
          actionType: "withdrawal.reject",
          targetResource: "wallets",
          targetId: ref,
          diffPayload: `{ status: "pending → rejected", amount: ${w.amount}, fee: ${w.fee}, reason: "${reason}" }`,
          ipAddress: ip,
          actor: user.email,
        },
      });
      return "done" as const;
    });
  } catch (err) {
    if (isUniqueCollision(err)) return fail("Refund untuk penarikan ini sudah pernah dicatat.");
    throw err;
  }

  if (state === "missing") return fail("Penarikan tidak ditemukan.");
  if (state === "stale") return fail("Penarikan ini sudah diproses sebelumnya.");
  const rejected = await db.withdrawal.findUnique({ where: { ref }, select: { userId: true } });
  if (rejected) {
    await notify({
      userId: rejected.userId,
      kind: "withdrawal_decided",
      title: `Penarikan ${ref} ditolak`,
      body: `Dana dikembalikan ke dompet. Alasan: ${reason}`,
      link: "/dompet",
    });
  }
  revalidatePath("/admin");
  revalidatePath("/dompet");
  return { ok: true };
}
