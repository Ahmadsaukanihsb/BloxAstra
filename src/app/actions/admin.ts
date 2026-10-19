"use server";

import { headers } from "next/headers";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { creditTopUp, notifyTopUpCredited } from "@/lib/topup";
import { validImageDataUrl, normalizeExternalImageUrl, normalizeImageInput } from "@/lib/images";
import { parseServiceArt } from "@/lib/service-art";
import { SITE_LOGO_KEY, SITE_LOGO_MAX_BYTES } from "@/lib/site-logo";
import { SITE_FAVICON_KEY, SITE_FAVICON_MAX_BYTES } from "@/lib/site-favicon";
import { parseSitePopup, parseSitePromo } from "@/lib/site-notice";
import { parseSocialLinks } from "@/lib/social-links";
import {
  isValidSocialUrl,
  SOCIAL_LINKS_KEY,
  SOCIAL_SLOTS,
  SOCIAL_URL_MAX,
} from "@/lib/social-links-slots";
import {
  isValidNoticeHref,
  NOTICE_CTA_LABEL_MAX,
  POPUP_MESSAGE_MAX,
  POPUP_TITLE_MAX,
  PROMO_MESSAGE_MAX,
  SITE_POPUP_KEY,
  SITE_POPUP_MAX_BYTES,
  SITE_PROMO_KEY,
} from "@/lib/site-notice-slots";
import { LANDING_SECTION_KEY, parseLandingLayout } from "@/lib/landing-sections";
import {
  BLOG_CONTENT_MAX,
  BLOG_COVER_MAX_BYTES,
  BLOG_EXCERPT_MAX,
  BLOG_SLUG_MAX,
  BLOG_TITLE_MAX,
  blogPostLocalPath,
  isValidBlogSlug,
  parseBlogTags,
  serializeBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog";
import { isDecidableDispute, ACTIVE_ORDER_STATES } from "@/lib/order-meta";
import { appendLedger, isUniqueCollision } from "@/lib/ledger";
import {
  SERVICE_ART_KEY,
  SERVICE_ART_MAX_BYTES,
  SERVICE_ART_SLOTS,
  type ServiceArt,
} from "@/lib/service-art-slots";

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
  orderGamepassCover: z.number().positive(),
  orderGamepassNoCover: z.number().positive(),
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

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
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
  // A pool order can be disputed while still unclaimed (status `paid`, no
  // seller). "Release" would complete it with nobody to pay — escrow would
  // vanish. Only refund makes sense until a seller exists.
  if (outcome === "release" && !order.seller) {
    return fail("Pesanan ini belum punya penjual. Hanya refund yang bisa dipilih.");
  }

  const sellerEarning = order.total - order.platformFee;
  const ip = await clientIp();

  try {
    await db.$transaction(async (tx) => {
      const current = await tx.dispute.findUnique({
        where: { id: disputeId },
        select: { status: true },
      });
      // `open` (buyer just filed) and `under_review` (seller replied) are both
      // undecided. Accepting only `open` is what made a replied dispute
      // impossible to decide, with the money frozen and no path back.
      if (current && !isDecidableDispute(current.status)) {
        throw new AbortTxError("Sengketa ini sudah diputus sebelumnya.");
      }
      const disputeStateBefore = current?.status ?? "-";

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
            disputeState: `${disputeStateBefore} → ${
              outcome === "refund" ? "resolved_refund" : "resolved_release"
            }`,
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
        orderGamepassCover: d.orderGamepassCover,
        orderGamepassNoCover: d.orderGamepassNoCover,
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
        ["rate_gamepass_cover", previous.orderGamepassCover, d.orderGamepassCover],
        ["rate_gamepass_no_cover", previous.orderGamepassNoCover, d.orderGamepassNoCover],
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
        orderGamepassCover: DEFAULT_ORDER_RATES.gamepassCover,
        orderGamepassNoCover: DEFAULT_ORDER_RATES.gamepassNoCover,
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
  revalidatePath("/admin");
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
  revalidatePath("/admin");
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

const serviceArtSchema = z.object({
  // One entry per slot; `null` or "" means "go back to the built-in icon".
  art: z.record(z.string(), z.union([z.string(), z.null()])),
});

/**
 * Set or clear the artwork on the homepage shelf's four entry points.
 *
 * Slots the admin did not send are left alone, and a slot sent as null is
 * removed — so the panel can save one tile without having to re-upload the rest.
 * Anything that fails image validation is named in the error rather than
 * dropped silently: an upload that vanishes without explanation is worse than
 * one that is refused.
 */
export async function saveServiceArt(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = serviceArtSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const current = await db.setting.findUnique({ where: { key: SERVICE_ART_KEY } });
  const art: ServiceArt = parseServiceArt(current?.value);
  const rejected: string[] = [];
  const changes: string[] = [];

  for (const slot of SERVICE_ART_SLOTS) {
    const incoming = parsed.data.art[slot.key];
    if (incoming === undefined) continue;
    if (incoming === null || incoming === "") {
      if (art[slot.key]) {
        delete art[slot.key];
        changes.push(`${slot.key}: dihapus`);
      }
      continue;
    }
    if (!normalizeImageInput(incoming, SERVICE_ART_MAX_BYTES)) {
      rejected.push(slot.label);
      continue;
    }
    if (art[slot.key] !== incoming) {
      art[slot.key] = incoming;
      changes.push(`${slot.key}: diperbarui`);
    }
  }

  if (rejected.length) {
    return fail(
      `Gambar untuk ${rejected.join(", ")} ditolak. Pakai PNG/JPG/GIF/WebP di bawah ${Math.round(
        SERVICE_ART_MAX_BYTES / 1000,
      )}KB, atau tempel URL https:// yang valid.`,
    );
  }

  if (!changes.length) return { ok: true };

  try {
    return await persistServiceArt(art, changes, user.email);
  } catch (error) {
    console.error("[service-art] gagal menyimpan", error);
    return fail(`Gagal menyimpan: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function persistServiceArt(
  art: ServiceArt,
  changes: string[],
  actor: string,
): Promise<AdminActionResult> {
  const ip = await clientIp();
  const value = JSON.stringify(art);

  await db.$transaction(async (tx) => {
    if (Object.keys(art).length === 0) {
      await tx.setting.deleteMany({ where: { key: SERVICE_ART_KEY } });
    } else {
      await tx.setting.upsert({
        where: { key: SERVICE_ART_KEY },
        create: { key: SERVICE_ART_KEY, value },
        update: { value },
      });
    }
    await tx.adminAuditLog.create({
      data: {
        actionType: "service_art.update",
        targetResource: "landing",
        targetId: SERVICE_ART_KEY,
        diffPayload: JSON.stringify(
          Object.fromEntries(changes.map((entry) => entry.split(": ") as [string, string])),
        ),
        ipAddress: ip,
        actor,
      },
    });
  });

  updateTag("service-art");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────── moderasi produk ─────────────────────── */

const productModerationSchema = z.object({
  productId: z.string().min(1).max(50),
  listed: z.boolean(),
});

/** Takedown (hide) or restore an owned listing. Takedown never deletes —
 *  running orders keep their product reference and history stays intact. */
export async function setProductListedAdmin(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = productModerationSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, title: true, isListed: true, sellerId: true },
  });
  if (!product) return fail("Listing tidak ditemukan.");
  if (product.isListed === parsed.data.listed) return { ok: true };

  const ip = await clientIp();
  await db.$transaction([
    db.product.update({ where: { id: product.id }, data: { isListed: parsed.data.listed } }),
    db.adminAuditLog.create({
      data: {
        actionType: parsed.data.listed ? "product.restore" : "product.takedown",
        targetResource: "products",
        targetId: product.id,
        diffPayload: JSON.stringify({
          slug: product.slug,
          title: product.title,
          isListed: `${product.isListed} → ${parsed.data.listed}`,
        }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("catalog");
  revalidatePath("/katalog");
  revalidatePath(`/produk/${product.slug}`);
  revalidatePath("/admin");
  return { ok: true };
}

const productFeaturedSchema = z.object({
  productId: z.string().min(1).max(50),
  featured: z.boolean(),
});

/** Pin or unpin a listing on the homepage shelf. */
export async function setProductFeaturedAdmin(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = productFeaturedSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, title: true },
  });
  if (!product) return fail("Listing tidak ditemukan.");

  const ip = await clientIp();
  await db.$transaction([
    db.product.update({ where: { id: product.id }, data: { featured: parsed.data.featured } }),
    db.adminAuditLog.create({
      data: {
        actionType: "product.feature",
        targetResource: "products",
        targetId: product.id,
        diffPayload: JSON.stringify({ slug: product.slug, featured: parsed.data.featured }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("catalog");
  revalidatePath("/");
  revalidatePath(`/produk/${product.slug}`);
  revalidatePath("/admin");
  return { ok: true };
}

const productImageSchema = z.object({
  productId: z.string().min(1).max(50),
  /**
   * Either a data URL (uploaded file) or an https URL (pasted link).
   * `null` clears the photo back to generative art.
   */
  image: z.string().max(2_100_000).nullable(),
});

/**
 * Set or clear a listing's photo from the admin panel — by pasted https URL or
 * an uploaded data URL. Admin-only on purpose: this writes a value that renders
 * as `<img src>` on public pages, so it must not be reachable by sellers (who
 * already have their own upload path) or by anyone unauthenticated.
 *
 * Both accepted shapes are validated before storage: an external URL must be
 * https, credential-free, and non-private (`normalizeExternalImageUrl`), and a
 * data URL must be a real PNG/JPEG/GIF/WebP under the size cap.
 */
export async function setProductImageAdmin(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = productImageSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, title: true, imageUrl: true },
  });
  if (!product) return fail("Listing tidak ditemukan.");

  let stored: string | null = null;
  if (parsed.data.image !== null) {
    const raw = parsed.data.image.trim();
    if (raw.startsWith("data:")) {
      if (!validImageDataUrl(raw, 1_500_000)) {
        return fail("Foto harus PNG/JPG/GIF/WebP maksimal 1,5MB.");
      }
      stored = raw;
    } else {
      const external = normalizeExternalImageUrl(raw);
      if (!external) {
        return fail("URL harus alamat https:// yang valid (bukan localhost/alamat internal).");
      }
      stored = external;
    }
  }

  const ip = await clientIp();
  await db.$transaction([
    db.product.update({ where: { id: product.id }, data: { imageUrl: stored } }),
    db.adminAuditLog.create({
      data: {
        actionType: "product.image",
        targetResource: "products",
        targetId: product.id,
        diffPayload: JSON.stringify({
          slug: product.slug,
          image: stored === null ? "cleared" : stored.startsWith("data:") ? "upload" : stored,
        }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("catalog");
  revalidatePath("/katalog");
  revalidatePath(`/produk/${product.slug}`);
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────── moderasi pengguna ─────────────────────── */

const suspendSchema = z.object({
  userId: z.string().min(1).max(50),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(300),
});

/**
 * Suspend an account: existing sessions stop working on next read, and
 * password/OAuth logins are refused. Guarded to pending-only so double
 * clicks and concurrent admins cannot overwrite each other's reason.
 */
export async function suspendUser(rawInput: unknown): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = suspendSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  if (parsed.data.userId === admin.id) {
    return fail("Akun sendiri tidak bisa ditangguhkan.");
  }

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, username: true, role: true, suspendedAt: true },
  });
  if (!target) return fail("Pengguna tidak ditemukan.");
  // Admin accounts are only manageable out-of-band (DB / provider console):
  // one compromised admin must never be able to lock out every other admin.
  if (target.role === "admin") {
    return fail("Akun admin tidak bisa ditangguhkan dari panel ini.");
  }
  if (target.suspendedAt) return fail("Akun ini sudah ditangguhkan.");

  const ip = await clientIp();
  const updated = await db.$transaction(async (tx) => {
    const count = await tx.user.updateMany({
      where: { id: target.id, suspendedAt: null },
      data: { suspendedAt: new Date(), suspendReason: parsed.data.reason },
    });
    if (count.count === 0) return false;
    await tx.adminAuditLog.create({
      data: {
        actionType: "user.suspend",
        targetResource: "users",
        targetId: target.id,
        diffPayload: JSON.stringify({ username: target.username, reason: parsed.data.reason }),
        ipAddress: ip,
        actor: admin.email,
      },
    });
    return true;
  });
  if (!updated) return fail("Akun ini sudah ditangguhkan.");

  revalidatePath("/admin");
  return { ok: true };
}

const unsuspendSchema = z.object({ userId: z.string().min(1).max(50) });

/** Lift a suspension. The user can sign in again immediately. */
export async function unsuspendUser(rawInput: unknown): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = unsuspendSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const target = await db.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, username: true },
  });
  if (!target) return fail("Pengguna tidak ditemukan.");

  const ip = await clientIp();
  const updated = await db.$transaction(async (tx) => {
    const count = await tx.user.updateMany({
      where: { id: target.id, suspendedAt: { not: null } },
      data: { suspendedAt: null, suspendReason: null },
    });
    if (count.count === 0) return false;
    await tx.adminAuditLog.create({
      data: {
        actionType: "user.unsuspend",
        targetResource: "users",
        targetId: target.id,
        diffPayload: JSON.stringify({ username: target.username }),
        ipAddress: ip,
        actor: admin.email,
      },
    });
    return true;
  });
  if (!updated) return fail("Akun ini tidak sedang ditangguhkan.");

  revalidatePath("/admin");
  revalidatePath("/admin/cari");
  return { ok: true };
}

/* ───────────────────── ubah peran pengguna ───────────────────── */

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(50),
  role: z.enum(["buyer", "seller"]),
});

/**
 * Switch an account between buyer and seller from the admin panel.
 *
 * Promote (buyer → seller): the account becomes a *verified* seller right
 * away — KYC status plus the profile flag flip together, exactly like an
 * approved KYC. A `pending` state is never written here because the normal
 * KYC path demands documents the admin just bypassed (approveKyc refuses
 * doc-less approvals), which would strand the account in a queue with no way
 * out. A missing SellerProfile is created with placeholder details
 * (store name from the username, unique handle, tier 1, Jakarta) that the
 * seller can edit themselves afterwards.
 *
 * Demote (seller → buyer): the role flips to buyer, the storefront goes
 * offline (`isOnline: false`) so nothing new can be claimed or listed, but
 * the SellerProfile row is *kept* — products, orders, withdrawals and reviews
 * all point at the profile (not the role), so deleting it would orphan
 * history. Promoting the same account again reactivates that profile.
 *
 * Both directions are guarded: admins are out-of-band only (same rule as
 * suspend), the target's own account cannot be switched, and the switch is
 * refused while the seller still has ACTIVE_ORDER_STATES orders or a pending
 * withdrawal. Role is read from the DB on every request (getCurrentUser), so
 * the change takes effect immediately without kicking the user out.
 */
export async function changeUserRole(rawInput: unknown): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = changeRoleSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");
  const { userId, role } = parsed.data;
  if (userId === admin.id) {
    return fail("Peran akun sendiri tidak bisa diubah dari panel ini.");
  }

  const ip = await clientIp();
  const state = await db.$transaction(async (tx) => {
    const target = await tx.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        suspendedAt: true,
        sellerProfile: { select: { id: true, storeName: true } },
      },
    });
    if (!target) return { kind: "missing" } as const;
    if (target.role === "admin") {
      return { kind: "forbidden" } as const;
    }
    if (target.suspendedAt) {
      return { kind: "suspended" } as const;
    }
    if (target.role === role) {
      return { kind: "same", current: target.role } as const;
    }

    // A live storefront cannot change hands mid-flight: refuse while any
    // order still references this profile in an in-progress state, or a
    // withdrawal is awaiting a decision.
    if (target.sellerProfile) {
      const [openOrders, pendingWithdrawals] = await Promise.all([
        tx.order.count({
          where: { sellerId: target.sellerProfile.id, status: { in: ACTIVE_ORDER_STATES } },
        }),
        tx.withdrawal.count({
          where: { sellerId: target.sellerProfile.id, status: "pending" },
        }),
      ]);
      if (openOrders > 0 || pendingWithdrawals > 0) {
        return { kind: "busy", openOrders, pendingWithdrawals } as const;
      }
    }

    const from = target.role;
    if (role === "seller") {
      const updated = await tx.user.updateMany({
        where: { id: userId, role: from },
        data: { role: "seller", kycStatus: "verified" },
      });
      if (updated.count === 0) return { kind: "stale" } as const;
      if (target.sellerProfile) {
        await tx.sellerProfile.update({
          where: { id: target.sellerProfile.id },
          data: { kycVerified: true, kycRejectReason: null },
        });
      } else {
        const handleBase = target.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "toko";
        let handle = handleBase;
        let suffix = 0;
        while (await tx.sellerProfile.findUnique({ where: { handle }, select: { id: true } })) {
          suffix += 1;
          handle = `${handleBase}${suffix}`;
        }
        await tx.sellerProfile.create({
          data: {
            userId,
            storeName: `${target.username} Store`,
            handle,
            tier: 1,
            city: "Jakarta",
            bio: "Toko diaktifkan oleh admin dari panel pengguna.",
            kycVerified: true,
          },
        });
      }
    } else {
      const updated = await tx.user.updateMany({
        where: { id: userId, role: from },
        data: { role: "buyer" },
      });
      if (updated.count === 0) return { kind: "stale" } as const;
      // Take the storefront offline but keep the profile row: products,
      // orders, withdrawals and reviews all reference it, so deleting it
      // would orphan history. kycVerified stays true, so a later promote
      // simply reactivates the same store.
      await tx.sellerProfile.updateMany({
        where: { userId },
        data: { isOnline: false },
      });
    }

    await tx.adminAuditLog.create({
      data: {
        actionType: "user.change_role",
        targetResource: "users",
        targetId: userId,
        diffPayload: JSON.stringify({
          username: target.username,
          role: `${from} → ${role}`,
        }),
        ipAddress: ip,
        actor: admin.email,
      },
    });
    return { kind: "done", from } as const;
  });

  if (state.kind === "missing") return fail("Pengguna tidak ditemukan.");
  if (state.kind === "forbidden") return fail("Akun admin tidak bisa diubah dari panel ini.");
  if (state.kind === "suspended") {
    return fail("Pulihkan dulu akun yang ditangguhkan sebelum mengubah perannya.");
  }
  if (state.kind === "same") {
    return fail(state.current === "seller" ? "Akun ini sudah menjadi penjual." : "Akun ini sudah menjadi pembeli.");
  }
  if (state.kind === "stale") return fail("Peran akun ini baru saja berubah. Muat ulang lalu coba lagi.");
  if (state.kind === "busy") {
    const parts: string[] = [];
    if (state.openOrders > 0) parts.push(`${state.openOrders} pesanan berjalan`);
    if (state.pendingWithdrawals > 0) parts.push(`${state.pendingWithdrawals} penarikan menunggu`);
    return fail(`Selesaikan dulu ${parts.join(" dan ")} sebelum mengubah peran.`);
  }

  await notify({
    userId,
    kind: "role_changed",
    title: state.from === "seller" ? "Akunmu kini pembeli" : "Akunmu kini penjual",
    body:
      state.from === "seller"
        ? "Tokomu dinonaktifkan oleh admin; riwayat pesanan dan penarikan tetap tersimpan."
        : "Tokomu diaktifkan oleh admin dan langsung terverifikasi. Lengkapi nama toko dan profil di dashboard penjual.",
    link: role === "seller" ? "/dashboard/penjual" : "/profil",
  });
  revalidatePath("/admin");
  revalidatePath("/admin/cari");
  return { ok: true };
}

/* ─────────────────────────── promo ─────────────────────────── */

const promoCodePattern = /^[A-Z0-9_-]{3,20}$/;

const promoCreateSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(promoCodePattern, "Kode 3–20 karakter: huruf, angka, _ atau -."),
  type: z.enum(["fixed", "percent"]),
  value: z.number().int().positive().max(100_000_000),
  maxUses: z.number().int().positive().max(1_000_000).nullable().optional(),
  note: z.string().trim().max(200).nullable().optional(),
});

/** Create a promo code. Percent values are 1–90 (a 100% code is a free shop). */
export async function createPromo(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = promoCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }
  const { code, type, value, note } = parsed.data;
  const maxUses = parsed.data.maxUses ?? null;
  if (type === "percent" && (value < 1 || value > 90)) {
    return fail("Diskon persen harus 1–90.");
  }
  if (type === "fixed" && value < 500) {
    return fail("Potongan nominal minimal Rp500.");
  }

  const ip = await clientIp();
  try {
    await db.$transaction([
      db.promoCode.create({
        data: { code, type, value, maxUses, note: note || null },
      }),
      db.adminAuditLog.create({
        data: {
          actionType: "promo.create",
          targetResource: "promos",
          targetId: code,
          diffPayload: JSON.stringify({ code, type, value, maxUses }),
          ipAddress: ip,
          actor: user.email,
        },
      }),
    ]);
  } catch (err) {
    if (isUniqueCollision(err)) return fail(`Kode ${code} sudah dipakai.`);
    throw err;
  }

  revalidatePath("/admin");
  return { ok: true };
}

const promoToggleSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(20),
  active: z.boolean(),
});

/** Enable or disable a promo without deleting its redemption history. */
export async function setPromoActive(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = promoToggleSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const row = await db.promoCode.findUnique({
    where: { code: parsed.data.code },
    select: { code: true, active: true },
  });
  if (!row) return fail("Kode promo tidak ditemukan.");
  if (row.active === parsed.data.active) return { ok: true };

  const ip = await clientIp();
  await db.$transaction([
    db.promoCode.update({ where: { code: row.code }, data: { active: parsed.data.active } }),
    db.adminAuditLog.create({
      data: {
        actionType: parsed.data.active ? "promo.enable" : "promo.disable",
        targetResource: "promos",
        targetId: row.code,
        diffPayload: JSON.stringify({ active: `${row.active} → ${parsed.data.active}` }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  revalidatePath("/admin");
  return { ok: true };
}

const promoDeleteSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(20),
});

/**
 * Delete a promo that nobody ever used. Codes with redemptions are kept for
 * the ledger trail — disable them instead.
 */
export async function deletePromo(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = promoDeleteSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const ip = await clientIp();
  const state = await db.$transaction(async (tx) => {
    const row = await tx.promoCode.findUnique({
      where: { code: parsed.data.code },
      select: { code: true, usedCount: true },
    });
    if (!row) return "missing" as const;
    if (row.usedCount > 0) return "used" as const;
    await tx.promoCode.delete({ where: { code: row.code } });
    await tx.adminAuditLog.create({
      data: {
        actionType: "promo.delete",
        targetResource: "promos",
        targetId: row.code,
        diffPayload: JSON.stringify({ code: row.code }),
        ipAddress: ip,
        actor: user.email,
      },
    });
    return "done" as const;
  });

  if (state === "missing") return fail("Kode promo tidak ditemukan.");
  if (state === "used") {
    return fail("Sudah pernah dipakai — nonaktifkan saja agar riwayat tetap utuh.");
  }

  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────── moderasi ulasan ─────────────────────── */

const reviewIdSchema = z.string().min(1).max(50);

/**
 * Recompute a seller's public rating from VISIBLE reviews only. Shared by
 * hide/unhide so the storefront number always matches what buyers can see.
 */
async function recomputeSellerRating(
  tx: import("@prisma/client").Prisma.TransactionClient,
  sellerId: string,
): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { sellerId, hidden: false },
    _avg: { rating: true },
    _count: true,
  });
  await tx.sellerProfile.update({
    where: { id: sellerId },
    data: {
      rating: Math.round((agg._avg.rating ?? 0) * 10) / 10,
      reviewCount: agg._count,
    },
  });
}

/** Hide one buyer review from every public surface (reversible). */
export async function hideReview(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = reviewIdSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const review = await db.review.findUnique({
    where: { id: parsed.data },
    select: { id: true, hidden: true, sellerId: true, buyerId: true, rating: true },
  });
  if (!review) return fail("Ulasan tidak ditemukan.");
  if (review.hidden) return fail("Ulasan ini sudah disembunyikan.");

  const ip = await clientIp();
  await db.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data: { hidden: true } });
    if (review.sellerId) await recomputeSellerRating(tx, review.sellerId);
    await tx.adminAuditLog.create({
      data: {
        actionType: "review.hide",
        targetResource: "reviews",
        targetId: review.id,
        diffPayload: JSON.stringify({ buyerId: review.buyerId, rating: review.rating }),
        ipAddress: ip,
        actor: user.email,
      },
    });
  });

  updateTag("catalog");
  revalidatePath("/admin");
  return { ok: true };
}

/** Restore a hidden review to every public surface. */
export async function unhideReview(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = reviewIdSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const review = await db.review.findUnique({
    where: { id: parsed.data },
    select: { id: true, hidden: true, sellerId: true },
  });
  if (!review) return fail("Ulasan tidak ditemukan.");
  if (!review.hidden) return fail("Ulasan ini tidak sedang disembunyikan.");

  const ip = await clientIp();
  await db.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data: { hidden: false } });
    if (review.sellerId) await recomputeSellerRating(tx, review.sellerId);
    await tx.adminAuditLog.create({
      data: {
        actionType: "review.unhide",
        targetResource: "reviews",
        targetId: review.id,
        diffPayload: JSON.stringify({ reviewId: review.id }),
        ipAddress: ip,
        actor: user.email,
      },
    });
  });

  updateTag("catalog");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────────── settings ─────────────────────────── */

const feesSchema = z.object({
  qris: z.number().int().min(0).max(100_000),
  va: z.number().int().min(0).max(100_000),
  ewallet: z.number().int().min(0).max(100_000),
});

async function saveSetting(key: string, value: unknown, action: string, actor: string): Promise<void> {
  const ip = await clientIp();
  const serialized = JSON.stringify(value);
  await db.$transaction([
    db.setting.upsert({ where: { key }, create: { key, value: serialized }, update: { value: serialized } }),
    db.adminAuditLog.create({
      data: {
        actionType: action,
        targetResource: "settings",
        targetId: key,
        diffPayload: serialized,
        ipAddress: ip,
        actor,
      },
    }),
  ]);
}

/** Gateway fees per payment method (rupiah, added on top of the subtotal). */
export async function updatePaymentFees(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = feesSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Biaya harus angka 0–100.000 per metode.");

  await saveSetting("payment.fees", parsed.data, "setting.fees", user.email);
  revalidatePath("/admin");
  return { ok: true };
}

const withdrawalConfigSchema = z.object({
  minAmount: z.number().int().min(1_000).max(1_000_000_000),
  fee: z.number().int().min(0).max(100_000),
});

/** Minimum withdrawal amount and the admin fee deducted with it. */
export async function updateWithdrawalConfig(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = withdrawalConfigSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Minimum ≥ Rp1.000, biaya 0–100.000.");

  await saveSetting("withdrawal", parsed.data, "setting.withdrawal", user.email);
  revalidatePath("/admin");
  return { ok: true };
}

const banksSchema = z.object({
  banks: z.array(z.string().trim().min(2).max(30)).min(1).max(20),
});

/** Bank / e-wallet list offered on the withdrawal form (deduped, order kept). */
export async function updateBanks(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = banksSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Isi 1–20 bank, tiap nama 2–30 karakter.");

  const deduped = [...new Set(parsed.data.banks.map((name) => name.trim()))].filter(Boolean);
  if (deduped.length === 0) return fail("Isi minimal satu bank.");
  await saveSetting("banks", deduped, "setting.banks", user.email);
  revalidatePath("/admin");
  return { ok: true };
}

const sweepTimeoutsSchema = z.object({
  poolHours: z.number().min(1).max(168),
  processingDays: z.number().min(1).max(30),
  assignedHours: z.number().min(1).max(720),
});

/** Auto-refund windows enforced by the sweep worker. */
export async function updateSweepTimeouts(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = sweepTimeoutsSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Pool 1–168 jam, processing 1–30 hari, assigned 1–720 jam.");

  await saveSetting("sweep.timeouts", parsed.data, "setting.sweep", user.email);
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────────── top-up ─────────────────────────── */

const topUpCodeSchema = z.string().regex(/^TU-[A-Z0-9]{6}$/, "Kode top-up tidak valid.");

/**
 * Manually credit a top-up after verifying the money off-band (bank
 * statement, gateway dashboard). An admin decision counts as settlement
 * proof, so even a `failed` row can be credited — every credit is audited.
 */
export async function creditTopUpManual(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = topUpCodeSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Kode top-up tidak valid.");

  const topUp = await db.topUp.findUnique({
    where: { code: parsed.data },
    select: { userId: true, amount: true, status: true },
  });
  if (!topUp) return fail("Top-up tidak ditemukan.");
  if (topUp.status === "credited") return fail("Top-up ini sudah dikreditkan.");

  const credited = await creditTopUp({
    userId: topUp.userId,
    code: parsed.data,
    amount: topUp.amount,
    settledByGateway: true,
  });
  if (!credited) return fail("Top-up ini sudah tidak bisa dikreditkan.");

  const ip = await clientIp();
  await db.adminAuditLog.create({
    data: {
      actionType: "topup.credit_manual",
      targetResource: "topups",
      targetId: parsed.data,
      diffPayload: JSON.stringify({ code: parsed.data, amount: topUp.amount }),
      ipAddress: ip,
      actor: user.email,
    },
  });
  await notifyTopUpCredited(topUp.userId, parsed.data, topUp.amount);

  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────── logo situs ─────────────────────── */

const siteLogoSchema = z.object({
  // Data-URL image, or null/""/missing to go back to the built-in mark.
  image: z.string().max(700_000).nullable().optional(),
});

/**
 * Set or clear the site logo. The header, footer, dashboard rail and auth
 * pages read it through the cached `getSiteLogo()` — no deploy needed.
 */
export async function saveSiteLogo(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = siteLogoSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const image = parsed.data.image ?? null;
  if (image !== null && image !== "" && !validImageDataUrl(image, SITE_LOGO_MAX_BYTES)) {
    return fail(
      `Logo harus gambar PNG/JPEG/GIF/WebP di bawah ${Math.round(SITE_LOGO_MAX_BYTES / 1000)}KB.`,
    );
  }

  const ip = await clientIp();
  const value = JSON.stringify({ image: image || null });
  await db.$transaction([
    db.setting.upsert({
      where: { key: SITE_LOGO_KEY },
      create: { key: SITE_LOGO_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "site_logo.update",
        targetResource: "landing",
        targetId: SITE_LOGO_KEY,
        diffPayload: JSON.stringify({ logo: image ? "diperbarui" : "direset bawaan" }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("site-logo");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

const siteFaviconSchema = z.object({
  // Data-URL image, or null/"" to go back to the built-in mark.
  image: z.string().max(400_000).nullable().optional(),
});

/**
 * Set or clear the browser-tab favicon. Stored like the site logo (a data URL
 * in Setting) and published into the root layout's `metadata.icons`, so a swap
 * needs no deploy.
 */
export async function saveSiteFavicon(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = siteFaviconSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const image = parsed.data.image ?? null;
  if (image !== null && image !== "" && !validImageDataUrl(image, SITE_FAVICON_MAX_BYTES)) {
    return fail(
      `Favicon harus gambar PNG/JPEG/GIF/WebP di bawah ${Math.round(SITE_FAVICON_MAX_BYTES / 1000)}KB.`,
    );
  }

  const ip = await clientIp();
  const value = JSON.stringify({ image: image || null });
  await db.$transaction([
    db.setting.upsert({
      where: { key: SITE_FAVICON_KEY },
      create: { key: SITE_FAVICON_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "site_favicon.update",
        targetResource: "landing",
        targetId: SITE_FAVICON_KEY,
        diffPayload: JSON.stringify({ favicon: image ? "diperbarui" : "direset bawaan" }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("site-favicon");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────── notifikasi situs (bilah + pop up) ─────────────────── */

const sitePromoSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(PROMO_MESSAGE_MAX),
  ctaLabel: z.string().max(NOTICE_CTA_LABEL_MAX),
  ctaHref: z.string().max(300),
});

/**
 * Set the promo strip above the navbar, or hide it. Copy, button and link are
 * all admin-authored; the strip is read through `getSitePromo()` in the root
 * layout, so nothing here needs a deploy.
 */
export async function saveSitePromo(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = sitePromoSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  if (!isValidNoticeHref(parsed.data.ctaHref)) {
    return fail("Tautan tombol harus path internal (mis. /daftar) atau URL https.");
  }
  if (parsed.data.enabled && !parsed.data.message.trim()) {
    return fail("Pesan bilah tidak boleh kosong selama bilah dinyalakan.");
  }

  const normalized = parseSitePromo(JSON.stringify(parsed.data));
  const ip = await clientIp();
  const value = JSON.stringify(normalized);
  await db.$transaction([
    db.setting.upsert({
      where: { key: SITE_PROMO_KEY },
      create: { key: SITE_PROMO_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "site_promo.update",
        targetResource: "landing",
        targetId: SITE_PROMO_KEY,
        diffPayload: JSON.stringify({
          bilah: normalized.enabled ? "tampil" : "disembunyikan",
          pesan: normalized.message,
        }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("site-promo");
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

const sitePopupSchema = z.object({
  enabled: z.boolean(),
  title: z.string().max(POPUP_TITLE_MAX),
  message: z.string().max(POPUP_MESSAGE_MAX),
  ctaLabel: z.string().max(NOTICE_CTA_LABEL_MAX),
  ctaHref: z.string().max(300),
  // Data-URL image or admin-pasted https URL; null/"" for a text-only pop-up.
  image: z.string().max(1_200_000).nullable().optional(),
});

/**
 * Set the homepage pop-up. Content changes bump `version`, and visitors
 * dismiss per version — so an edit reaches people who already closed the old
 * pop-up once, while saving again without changes re-shows it to nobody.
 */
export async function saveSitePopup(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = sitePopupSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  if (!isValidNoticeHref(parsed.data.ctaHref)) {
    return fail("Tautan tombol harus path internal (mis. /daftar) atau URL https.");
  }
  if (parsed.data.enabled && !parsed.data.title.trim() && !parsed.data.message.trim()) {
    return fail("Isi minimal judul atau pesan sebelum menyalakan pop up.");
  }
  const image = parsed.data.image ?? null;
  if (image !== null && image !== "" && !normalizeImageInput(image, SITE_POPUP_MAX_BYTES)) {
    return fail(
      `Gambar pop up harus PNG/JPEG/GIF/WebP di bawah ${Math.round(SITE_POPUP_MAX_BYTES / 1000)}KB, atau URL https yang valid.`,
    );
  }

  const normalized = parseSitePopup(JSON.stringify({ ...parsed.data, image: image || null }));

  // Keep the old version when nothing changed; stamp a new one otherwise.
  const existing = await db.setting.findUnique({ where: { key: SITE_POPUP_KEY } });
  const current = parseSitePopup(existing?.value);
  const sameContent =
    current.enabled === normalized.enabled &&
    current.title === normalized.title &&
    current.message === normalized.message &&
    current.ctaLabel === normalized.ctaLabel &&
    current.ctaHref === normalized.ctaHref &&
    current.image === normalized.image;
  const version = sameContent && current.version ? current.version : Date.now().toString(36);

  const ip = await clientIp();
  const value = JSON.stringify({ ...normalized, version });
  await db.$transaction([
    db.setting.upsert({
      where: { key: SITE_POPUP_KEY },
      create: { key: SITE_POPUP_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "site_popup.update",
        targetResource: "landing",
        targetId: SITE_POPUP_KEY,
        diffPayload: JSON.stringify({
          popup: normalized.enabled ? "tampil" : "disembunyikan",
          versi: version,
          judul: normalized.title,
        }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("site-popup");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────── sosial media (footer) ─────────────────── */

const socialLinksSchema = z.object({
  discord: z.string().max(SOCIAL_URL_MAX),
  instagram: z.string().max(SOCIAL_URL_MAX),
  tiktok: z.string().max(SOCIAL_URL_MAX),
  youtube: z.string().max(SOCIAL_URL_MAX),
  facebook: z.string().max(SOCIAL_URL_MAX),
  x: z.string().max(SOCIAL_URL_MAX),
  whatsapp: z.string().max(SOCIAL_URL_MAX),
});

/**
 * Set the footer's social links. One URL per platform, empty = the icon is
 * not rendered. Each link must be an https URL on the platform's own domain —
 * the read path enforces this too, but rejecting on write lets the admin know
 * which row is wrong instead of watching it disappear after saving.
 */
export async function saveSocialLinks(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = socialLinksSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  for (const slot of SOCIAL_SLOTS) {
    const value = parsed.data[slot.id].trim();
    if (value && !isValidSocialUrl(slot.id, value)) {
      return fail(`Tautan ${slot.label} harus URL https di domain ${slot.hosts.join(" atau ")}.`);
    }
  }

  const normalized = parseSocialLinks(JSON.stringify(parsed.data));
  const active = SOCIAL_SLOTS.filter((slot) => normalized[slot.id]).map((slot) => slot.label);
  const ip = await clientIp();
  const value = JSON.stringify(normalized);
  await db.$transaction([
    db.setting.upsert({
      where: { key: SOCIAL_LINKS_KEY },
      create: { key: SOCIAL_LINKS_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "site_social.update",
        targetResource: "landing",
        targetId: SOCIAL_LINKS_KEY,
        diffPayload: JSON.stringify({
          aktif: active.length > 0 ? active : "tidak ada (footer tanpa ikon sosial)",
        }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("site-social");
  revalidatePath("/", "layout");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────── susunan beranda ─────────────────── */

const landingLayoutSchema = z.object({
  order: z.array(z.string().min(1).max(30)).max(20),
  hidden: z.array(z.string().min(1).max(30)).max(20),
});

/**
 * Save the homepage section order + visibility. Unknown ids are dropped and
 * missing ones appended by `parseLandingLayout`, so a stale panel can never
 * break the homepage — the worst case is default order.
 */
export async function saveLandingLayout(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = landingLayoutSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const layout = parseLandingLayout(JSON.stringify(parsed.data));

  const ip = await clientIp();
  const value = JSON.stringify(layout);
  await db.$transaction([
    db.setting.upsert({
      where: { key: LANDING_SECTION_KEY },
      create: { key: LANDING_SECTION_KEY, value },
      update: { value },
    }),
    db.adminAuditLog.create({
      data: {
        actionType: "landing_layout.update",
        targetResource: "landing",
        targetId: LANDING_SECTION_KEY,
        diffPayload: value,
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  updateTag("landing-layout");
  revalidatePath("/");
  revalidatePath("/admin");
  return { ok: true };
}

/* ─────────────────────── laporan chat ─────────────────────── */

const reportIdSchema = z.string().min(1).max(50);

/** Dismiss a chat report without touching the message. */
export async function dismissChatReport(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = reportIdSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const report = await db.sellerChatReport.findUnique({
    where: { id: parsed.data },
    select: { id: true },
  });
  if (!report) return fail("Laporan tidak ditemukan.");

  const ip = await clientIp();
  await db.$transaction([
    db.sellerChatReport.delete({ where: { id: report.id } }),
    db.adminAuditLog.create({
      data: {
        actionType: "chat_report.dismiss",
        targetResource: "chat_reports",
        targetId: report.id,
        diffPayload: JSON.stringify({ reportId: report.id }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/dashboard/penjual/grup");
  return { ok: true };
}

/* ─────────────────────── blog ─────────────────────── */

export type BlogActionResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; error: string };

const blogPostSchema = z.object({
  id: z.string().min(1).max(50).nullable().optional(),
  title: z.string().trim().min(1).max(BLOG_TITLE_MAX),
  slug: z.string().max(BLOG_SLUG_MAX * 2),
  excerpt: z.string().max(BLOG_EXCERPT_MAX),
  content: z.string().max(BLOG_CONTENT_MAX),
  coverImage: z.string().max(1_200_000).nullable().optional(),
  tags: z.string().max(400),
  status: z.enum(["draft", "published"]),
});

/** Readers of the public blog are cached with the `blog` tag; drop it everywhere. */
function revalidateBlog(slugs: string[]) {
  updateTag("blog");
  revalidatePath("/blog");
  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidatePath(blogPostLocalPath(slug));
  }
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
}

/**
 * Create or update one blog post from the admin panel. The slug is always
 * derived through `slugifyBlogTitle` (from the admin's explicit slug, or the
 * title when empty), so URLs stay lowercase-dashed no matter what was typed.
 * `publishedAt` is stamped on first publish and kept afterwards, so editing an
 * old article does not move it to the top of /blog.
 */
export async function saveBlogPost(rawInput: unknown): Promise<BlogActionResult> {
  const user = await requireRole("admin");
  const parsed = blogPostSchema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Input tidak valid." };

  const slug = slugifyBlogTitle(parsed.data.slug.trim() || parsed.data.title);
  if (!isValidBlogSlug(slug)) {
    return { ok: false, error: "Slug kosong/tidak valid — isi judul atau slug dengan huruf biasa." };
  }
  if (parsed.data.status === "published" && !parsed.data.content.trim()) {
    return { ok: false, error: "Artikel perlu isi sebelum diterbitkan." };
  }

  const cover = parsed.data.coverImage ?? null;
  if (cover !== null && cover !== "" && !normalizeImageInput(cover, BLOG_COVER_MAX_BYTES)) {
    return {
      ok: false,
      error: `Sampul harus PNG/JPEG/GIF/WebP di bawah ${Math.round(BLOG_COVER_MAX_BYTES / 1000)}KB, atau URL https yang valid.`,
    };
  }

  const existing = parsed.data.id
    ? await db.blogPost.findUnique({ where: { id: parsed.data.id } })
    : null;
  if (parsed.data.id && !existing) return { ok: false, error: "Artikel tidak ditemukan." };

  const slugOwner = await db.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== existing?.id) {
    return { ok: false, error: `Slug "${slug}" sudah dipakai artikel lain.` };
  }

  const publishedAt =
    existing?.publishedAt ?? (parsed.data.status === "published" ? new Date() : null);
  const data = {
    slug,
    title: parsed.data.title,
    excerpt: parsed.data.excerpt.trim(),
    content: parsed.data.content,
    coverImage: cover || null,
    tags: serializeBlogTags(parseBlogTags(parsed.data.tags)),
    status: parsed.data.status,
    publishedAt,
    authorEmail: user.email,
  };

  const ip = await clientIp();
  const post = await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.blogPost.update({ where: { id: existing.id }, data })
      : await tx.blogPost.create({ data });
    await tx.adminAuditLog.create({
      data: {
        actionType: existing ? "blog_post.update" : "blog_post.create",
        targetResource: "blog",
        targetId: saved.id,
        diffPayload: JSON.stringify({
          slug: saved.slug,
          judul: saved.title,
          status: saved.status,
        }),
        ipAddress: ip,
        actor: user.email,
      },
    });
    return saved;
  });

  // Renames leave the old URL as a 404 — invalidate it too so the cached page
  // disappears immediately instead of after its next revalidation.
  revalidateBlog([post.slug, existing?.slug ?? ""]);
  return { ok: true, id: post.id, slug: post.slug };
}

/** Hapus permanen satu artikel (draf maupun terbit) + catat di jejak audit. */
export async function deleteBlogPost(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = z.string().min(1).max(50).safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const post = await db.blogPost.findUnique({ where: { id: parsed.data } });
  if (!post) return fail("Artikel tidak ditemukan.");

  const ip = await clientIp();
  await db.$transaction([
    db.blogPost.delete({ where: { id: post.id } }),
    db.adminAuditLog.create({
      data: {
        actionType: "blog_post.delete",
        targetResource: "blog",
        targetId: post.id,
        diffPayload: JSON.stringify({ slug: post.slug, judul: post.title }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  revalidateBlog([post.slug]);
  return { ok: true };
}

const chatMessageIdSchema = z.string().min(1).max(50);

/**
 * Remove a reported message (soft delete — the tombstone stays so the thread
 * keeps its shape) and clear all its reports in one transaction.
 */
export async function deleteChatMessageAdmin(rawInput: unknown): Promise<AdminActionResult> {
  const user = await requireRole("admin");
  const parsed = chatMessageIdSchema.safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");

  const message = await db.sellerChatMessage.findUnique({
    where: { id: parsed.data },
    select: { id: true, deletedAt: true, userId: true },
  });
  if (!message) return fail("Pesan tidak ditemukan.");

  const ip = await clientIp();
  await db.$transaction([
    db.sellerChatMessage.updateMany({
      where: { id: message.id, deletedAt: null },
      data: { deletedAt: new Date() },
    }),
    db.sellerChatReport.deleteMany({ where: { messageId: message.id } }),
    db.adminAuditLog.create({
      data: {
        actionType: "chat_message.delete",
        targetResource: "chat_messages",
        targetId: message.id,
        diffPayload: JSON.stringify({ messageId: message.id, authorId: message.userId }),
        ipAddress: ip,
        actor: user.email,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/dashboard/penjual/grup");
  return { ok: true };
}
