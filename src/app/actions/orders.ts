"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";

import { listingQuote } from "@/lib/robux-pricing";
import {
  gamepassOrderPrice,
  gamepassQuote,
  premiumSubtotal,
  robuxOrderConfig,
  robuxOrderPrice,
  type GamepassTaxMode,
} from "@/lib/robux-orders";
import { getActiveOrderRates, getActiveRateCard } from "@/lib/rate-card";
import {
  applyPaymentNotification,
  consumePromoCut,
  generateOrderCode,
  getPaymentFees,
  resolvePromoCut,
  type PaymentMethodId,
} from "@/lib/payments";
import { createSnapTransaction, fetchMidtransStatus, isSimMode } from "@/lib/midtrans";
import {
  createTripayTransaction,
  fetchTripayDetail,
  isTripayMode,
  tripayToMidtransStatus,
  TripayNotFoundError,
} from "@/lib/tripay";
import { creditTopUp, notifyTopUpCredited } from "@/lib/topup";
import { broadcastPoolOrder, poolKindLabel } from "@/lib/discord";
import { publishLive } from "@/lib/live-bus";
import { lookupRobloxUsers } from "@/lib/roblox";
import { checkThrottle } from "@/lib/throttle";
import { encryptCredentials, hasEncryptionKey } from "@/lib/credentials";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { appendLedger, isUniqueCollision } from "@/lib/ledger";

const usernamePattern = /^[A-Za-z0-9_]{3,20}$/;

const catalogOrderSchema = z.object({
  productSlug: z.string().min(1).max(200),
  mode: z.enum(["cover", "no_cover"]),
  quantity: z.number().int().min(1).max(5),
  robloxUsername: z.string().trim().regex(usernamePattern, "Username Roblox tidak valid."),
  paymentMethod: z.enum(["qris", "va", "ewallet", "saldo"]),
  promoCode: z.string().trim().max(20).optional(),
});

const robuxOrderSchema = z.object({
  kind: z.enum(["username", "login", "gamepass", "premium"]),
  // Monthly term (1–12) for premium, Robux amount for the other flows — the
  // per-kind bounds below do the real validation.
  robuxAmount: z.number().int().min(1).max(50_000),
  robloxUsername: z.string().trim().min(3).max(100),
  password: z.string().trim().min(4).max(128).optional(),
  parentalPin: z.string().trim().min(4).max(8).optional(),
  /** optional 2FA backup codes (premium/login) — sanitized below, never raw */
  twoFactorBackupCodes: z.string().trim().max(500).optional(),
  /** gamepass only — who swallows Roblox's 30% cut. Defaults to cover. */
  taxMode: z.enum(["cover", "no_cover"]).optional(),
  gamepassUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .refine(
      (value) => value === undefined || value === "" || /^https:\/\/[^\s/$.?#].[^\s]*$/i.test(value),
      "Tautan gamepass harus URL https yang valid.",
    ),
  buyerNote: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(["qris", "va", "saldo"]),
  promoCode: z.string().trim().max(20).optional(),
});

export type OrderActionResult =
  | { ok: true; checkoutUrl: string; orderCode: string }
  | {
    ok: false;
    code: "LOGIN" | "INVALID" | "NOT_FOUND" | "OUT_OF_STOCK" | "PAYMENT_FAILED" | "INSUFFICIENT";
    error: string;
  };

const MIN_TOTAL = 1_000;

export type ValidatePromoResult =
  | { ok: true; cut: number }
  | { ok: false; error: string };

export async function validatePromoAction(
  code: string,
  subtotal: number,
): Promise<ValidatePromoResult> {
  // Login-gated: an open oracle lets anyone enumerate live promo codes.
  const buyerId = await requireBuyerId();
  if (!buyerId) return { ok: false, error: "Masuk dulu untuk memakai promo." };
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { ok: false, error: "Kode promo kosong." };
  if (!Number.isFinite(subtotal) || subtotal <= 0)
    return { ok: false, error: "Subtotal tidak valid." };
  const cut = await resolvePromoCut(trimmed, subtotal);
  if (cut === null)
    return { ok: false, error: "Kode promo tidak valid atau kedaluwarsa." };
  return { ok: true, cut };
}

async function requireBuyerId(): Promise<string | null> {
  // Resolve through getCurrentUser so the money paths inherit the FULL checks:
  // account still exists, not suspended, and the cookie's sessionVersion still
  // matches (i.e. "log out of all devices" / password change evicts it).
  // A raw cookie read would let a stale session spend wallet balance.
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Live Roblox existence check, fail-OPEN: a username Roblox positively
 * rejects is refused, but a Roblox outage/timeout never blocks a legit
 * checkout (the client-side verifier already did the strict pass).
 */
async function rejectUnknownRobloxUser(username: string): Promise<string | null> {
  try {
    const [found] = await lookupRobloxUsers([username], 3500);
    if (!found) return `Username @${username} tidak ditemukan di Roblox.`;
    return null;
  } catch (error) {
    console.error("roblox lookup failed (fail-open)", error);
    return null;
  }
}

/** Persist an Order + Payment and hand back the (Snap or sim) checkout URL. */
async function persistOrder(input: {
  buyerId: string;
  kind: string;
  unitPrice: number;
  platformFee: number;
  total: number;
  quantity: number;
  productId?: string;
  sellerId?: string;
  robuxAmount?: number;
  robloxUsername?: string;
  credentialsEnc?: string;
  gamepassUrl?: string;
  buyerNote?: string;
  promoCode?: string;
  paymentMethod: PaymentMethodId;
  itemName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
}): Promise<OrderActionResult> {
  const provider = isSimMode() ? "sim" : isTripayMode() ? "tripay" : "midtrans";
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateOrderCode();
    try {
      const order = await db.$transaction(async (tx) => {
        if (input.productId) {
          const reserved = await tx.product.updateMany({
            where: { id: input.productId, stock: { gte: input.quantity } },
            data: { stock: { decrement: input.quantity } },
          });
          if (reserved.count === 0) {
            throw new OutOfStockError();
          }
        }
        if (input.promoCode) {
          const consumed = await consumePromoCut(tx, input.promoCode);
          if (!consumed) {
            throw new PromoExhaustedError();
          }
        }
        const created = await tx.order.create({
          data: {
            code,
            kind: input.kind,
            status: "pending_payment",
            buyerId: input.buyerId,
            productId: input.productId,
            sellerId: input.sellerId,
            // Robux & premium flows have no assigned seller — they enter the
            // shared pool so every seller can fight for them once paid.
            isPoolOrder: !input.productId && !input.sellerId,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            platformFee: input.platformFee,
            total: input.total,
            robuxAmount: input.robuxAmount,
            robloxUsername: input.robloxUsername,
            credentialsEnc: input.credentialsEnc,
            gamepassUrl: input.gamepassUrl,
            buyerNote: input.buyerNote,
            promoCode: input.promoCode,
            paymentMethod: input.paymentMethod,
          },
        });
        await tx.payment.create({
          data: {
            orderId: created.id,
            provider,
            amount: input.total,
            status: "pending",
            expiresAt,
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: created.id,
            state: "pending_payment",
            label: "Pesanan dibuat, menunggu pembayaran",
            actor: "buyer",
          },
        });
        return created;
      });

      try {
        // Tripay is the live gateway; Midtrans only serves invoices minted
        // before the switch. Both hand back a hosted checkout URL.
        const checkout = isTripayMode()
          ? await createTripayTransaction({
            orderId: order.code,
            grossAmount: input.total,
            itemName: input.itemName,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone,
            paymentMethod: input.paymentMethod,
          }).then((result) => ({ redirectUrl: result.redirectUrl, providerRef: result.reference }))
          : await createSnapTransaction({
            orderId: order.code,
            grossAmount: input.total,
            itemName: input.itemName,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
          }).then((result) => ({ redirectUrl: result.redirectUrl, providerRef: result.token }));
        await db.payment.update({
          where: { orderId: order.id },
          data: { checkoutUrl: checkout.redirectUrl, providerOrderId: checkout.providerRef },
        });
        updateTag("catalog");
        return { ok: true, checkoutUrl: checkout.redirectUrl, orderCode: order.code };
      } catch (snapError) {
        // Gateway unreachable — release the reservation and report cleanly.
        await restoreCancelledOrder(order.id);
        if (
          snapError instanceof Error &&
          (/Midtrans Snap 4\d\d:/.test(snapError.message) ||
            /Tripay create (4\d\d|ditolak)/.test(snapError.message))
        ) {
          // Deterministic client error (bad payload / key / channel) — a
          // fresh order code cannot fix it, so fail fast instead of retrying.
          console.error("persistOrder failed", snapError);
          return {
            ok: false,
            code: "PAYMENT_FAILED",
            error: "Gateway menolak pesanan ini. Coba metode bayar lain atau hubungi admin.",
          };
        }
        lastError = snapError;
        continue;
      }
    } catch (error) {
      if (error instanceof OutOfStockError) {
        return { ok: false, code: "OUT_OF_STOCK", error: "Stok habis untuk jumlah ini." };
      }
      if (error instanceof PromoExhaustedError) {
        return { ok: false, code: "INVALID", error: "Kode promo baru saja habis dipakai orang lain." };
      }
      // Unique-code collision — retry with a fresh code.
      if (isUniqueCollision(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  console.error("persistOrder failed", lastError);
  return {
    ok: false,
    code: "PAYMENT_FAILED",
    error: "Gateway pembayaran sedang bermasalah. Coba lagi sebentar lagi.",
  };
}

class OutOfStockError extends Error { }

class InsufficientBalanceError extends Error { }

class PromoExhaustedError extends Error { }

/** Append a wallet ledger row on top of the buyer's running balance (in-tx). */

/**
 * Wallet-balance checkout: reserve stock, debit the buyer's ledger, and flip
 * the order straight to `paid` inside ONE transaction — no gateway involved.
 * The balance is re-read inside the transaction so two concurrent checkouts
 * can never both spend the same rupiah.
 */
async function persistWalletOrder(input: {
  buyerId: string;
  kind: string;
  unitPrice: number;
  platformFee: number;
  total: number;
  quantity: number;
  productId?: string;
  sellerId?: string;
  robuxAmount?: number;
  robloxUsername?: string;
  credentialsEnc?: string;
  gamepassUrl?: string;
  buyerNote?: string;
  promoCode?: string;
  itemName: string;
}): Promise<OrderActionResult> {
  let autoReleaseHours = 24;
  if (input.productId) {
    const product = await db.product.findUnique({
      where: { id: input.productId },
      select: { autoReleaseHours: true },
    });
    if (product) autoReleaseHours = product.autoReleaseHours;
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateOrderCode();
    try {
      await db.$transaction(async (tx) => {
        if (input.productId) {
          const reserved = await tx.product.updateMany({
            where: { id: input.productId, stock: { gte: input.quantity } },
            data: { stock: { decrement: input.quantity } },
          });
          if (reserved.count === 0) {
            throw new OutOfStockError();
          }
        }

        if (input.promoCode) {
          const consumed = await consumePromoCut(tx, input.promoCode);
          if (!consumed) {
            throw new PromoExhaustedError();
          }
        }

        // Serialize concurrent spenders on the same buyer: touching the User
        // row takes a row lock in Postgres, so a second checkout for the same
        // buyer waits for the first to commit before reading the balance.
        // Without this, two tx under read-committed can both see the same
        // pre-deduction balance and both succeed (overdraft). SQLite
        // serializes the whole DB anyway, so this is a no-op there.
        await tx.user.update({
          where: { id: input.buyerId },
          data: { updatedAt: new Date() },
        });

        const aggregate = await tx.walletLedger.aggregate({
          where: { userId: input.buyerId },
          _sum: { amount: true },
        });
        if ((aggregate._sum.amount ?? 0) < input.total) {
          throw new InsufficientBalanceError();
        }

        const created = await tx.order.create({
          data: {
            code,
            kind: input.kind,
            status: "paid",
            buyerId: input.buyerId,
            productId: input.productId,
            sellerId: input.sellerId,
            isPoolOrder: !input.productId && !input.sellerId,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
            platformFee: input.platformFee,
            total: input.total,
            robuxAmount: input.robuxAmount,
            robloxUsername: input.robloxUsername,
            credentialsEnc: input.credentialsEnc,
            gamepassUrl: input.gamepassUrl,
            buyerNote: input.buyerNote,
            promoCode: input.promoCode,
            paymentMethod: "saldo",
            autoReleaseAt: new Date(Date.now() + autoReleaseHours * 3_600_000),
          },
        });
        await tx.payment.create({
          data: {
            orderId: created.id,
            provider: "saldo",
            amount: input.total,
            status: "settled",
            checkoutUrl: `/pesanan/${code}`,
            rawJson: JSON.stringify({ wallet: true, at: new Date().toISOString() }),
          },
        });
        await tx.orderEvent.create({
          data: {
            orderId: created.id,
            state: "paid",
            label: "Dibayar dengan Saldo Akun, dana ditahan platform",
            actor: "buyer",
          },
        });
        await appendLedger(tx, {
          userId: input.buyerId,
          type: "purchase",
          amount: -input.total,
          note: `Belanja ${input.itemName} (${code})`,
          orderCode: code,
        });
      });

      if (input.productId) updateTag("catalog");
      await notify({
        userId: input.buyerId,
        kind: "order_paid",
        title: `Pembayaran ${code} lunas via Saldo`,
        body: "Dana ditahan platform. Penjual segera memproses pesananmu.",
        link: `/pesanan/${code}`,
      });
      // Pool race: same broadcast as the gateway path (fire-and-forget). The
      // live ping matters as much as Discord: without it the rebutan boards
      // only learn about a Saldo-paid order on their next 25s poll, and the
      // arrival chime never fires at all.
      if (!input.productId && !input.sellerId) {
        await broadcastPoolOrder({
          code,
          kind: input.kind,
          kindLabel: poolKindLabel(input.kind),
          robuxAmount: input.robuxAmount ?? null,
          total: input.total,
        });
        publishLive("pool", "sellers", "arrived");
      }
      return { ok: true, checkoutUrl: `/pesanan/${code}`, orderCode: code };
    } catch (error) {
      if (error instanceof OutOfStockError) {
        return { ok: false, code: "OUT_OF_STOCK", error: "Stok habis untuk jumlah ini." };
      }
      if (error instanceof InsufficientBalanceError) {
        // The whole transaction rolled back, so the stock reservation never
        // persisted — nothing to restore.
        return {
          ok: false,
          code: "INSUFFICIENT",
          error: "Saldo tidak mencukupi. Selesaikan pembayaran lain dulu atau pilih QRIS / Virtual Account.",
        };
      }
      if (error instanceof PromoExhaustedError) {
        return { ok: false, code: "INVALID", error: "Kode promo baru saja habis dipakai orang lain." };
      }
      if (isUniqueCollision(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  console.error("persistWalletOrder failed", lastError);
  return {
    ok: false,
    code: "PAYMENT_FAILED",
    error: "Gagal membuat pesanan. Coba lagi sebentar lagi.",
  };
}

async function restoreCancelledOrder(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order) return;
  // Guarded: a settlement that landed between order creation and this restore
  // wins — we must not clobber a paid order back to cancelled.
  await db.$transaction(async (tx) => {
    const cancelled = await tx.order.updateMany({
      where: { id: order.id, status: "pending_payment" },
      data: { status: "cancelled" },
    });
    if (cancelled.count === 0) return;
    if (order.productId) {
      await tx.product.update({
        where: { id: order.productId },
        data: { stock: { increment: order.quantity } },
      });
    }
    // Give back the promo redemption consumed at creation — the buyer never
    // got an order for it (gateway failure path only).
    if (order.promoCode) {
      await tx.promoCode.updateMany({
        where: { code: order.promoCode },
        data: { usedCount: { decrement: 1 } },
      });
    }
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        state: "cancelled",
        label: "Pembayaran gagal dibuat, stok dikembalikan",
        actor: "system",
      },
    });
    if (order.payment) {
      await tx.payment.updateMany({
        where: { id: order.payment.id, status: "pending" },
        data: { status: "failed" },
      });
    }
  });
  if (order.productId) updateTag("catalog");
}

/** Create a catalog (marketplace listing) order and return its checkout URL. */
export async function createCatalogOrder(rawInput: unknown): Promise<OrderActionResult> {
  const buyerId = await requireBuyerId();
  if (!buyerId) {
    return { ok: false, code: "LOGIN", error: "Login dulu untuk checkout." };
  }
  // One invoice per 5s per buyer: blocks double-click storms and checkout
  // loops from minting junk Snap invoices.
  if (!checkThrottle(`checkout:${buyerId}`, 5000)) {
    return { ok: false, code: "INVALID", error: "Terlalu cepat. Tunggu 5 detik sebelum checkout lagi." };
  }

  const parsed = catalogOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const input = parsed.data;

  const product = await db.product.findUnique({
    where: { slug: input.productSlug },
    include: {
      category: { select: { commissionPercent: true } },
      seller: { select: { id: true, storeName: true, userId: true } },
    },
  });
  if (!product) {
    return { ok: false, code: "NOT_FOUND", error: "Listing tidak ditemukan." };
  }
  if (!product.isListed) {
    return { ok: false, code: "NOT_FOUND", error: "Listing ini sedang dijeda penjual." };
  }
  if (product.seller.userId === buyerId) {
    return { ok: false, code: "INVALID", error: "Kamu tidak bisa membeli listing milik sendiri." };
  }

  const unknownUser = await rejectUnknownRobloxUser(input.robloxUsername);
  if (unknownUser) {
    return { ok: false, code: "INVALID", error: unknownUser };
  }

  const rateCard = await getActiveRateCard();
  const subtotal = product.netRobux
    ? listingQuote(product.netRobux, input.mode, input.quantity, rateCard).totalIdr
    : product.price * input.quantity;

  let promoCut = 0;
  if (input.promoCode) {
    const cut = await resolvePromoCut(input.promoCode, subtotal);
    if (cut === null) {
      return { ok: false, code: "INVALID", error: "Kode promo tidak valid atau kedaluwarsa." };
    }
    promoCut = cut;
  }

  // Commission is charged on the DISCOUNTED subtotal — platform promos are
  // funded by the platform (lower commission), never silently by the seller.
  const discounted = Math.max(0, subtotal - promoCut);
  const commission = Math.round((discounted * product.category.commissionPercent) / 100);
  const fees = await getPaymentFees();
  const methodFee = fees[input.paymentMethod];

  const total = Math.max(MIN_TOTAL, discounted + commission + methodFee);

  const buyer = await db.user.findUnique({
    where: { id: buyerId },
    select: { username: true, email: true, whatsapp: true },
  });

  const base = {
    buyerId,
    kind: "catalog",
    unitPrice: subtotal,
    platformFee: commission + methodFee,
    total,
    quantity: input.quantity,
    productId: product.id,
    sellerId: product.seller.id,
    robloxUsername: input.robloxUsername,
    promoCode: input.promoCode,
    itemName: product.title,
  };

  if (input.paymentMethod === "saldo") {
    return persistWalletOrder(base);
  }

  return persistOrder({
    ...base,
    paymentMethod: input.paymentMethod,
    customerName: buyer?.username ?? "Pembeli",
    customerEmail: buyer?.email ?? "",
    customerPhone: buyer?.whatsapp ?? undefined,
  });
}

/** Create one of the three /beli robux orders and return its checkout URL. */
export async function createRobuxOrder(rawInput: unknown): Promise<OrderActionResult> {
  const buyerId = await requireBuyerId();
  if (!buyerId) {
    return { ok: false, code: "LOGIN", error: "Login dulu untuk membeli Robux." };
  }
  if (!checkThrottle(`checkout:${buyerId}`, 5000)) {
    return { ok: false, code: "INVALID", error: "Terlalu cepat. Tunggu 5 detik sebelum checkout lagi." };
  }

  const parsed = robuxOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      error: parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }
  const input = parsed.data;

  const bounds = robuxOrderConfig(input.kind);

  // Gamepass has two tax modes: `cover` bills the net Robux, `no_cover` bills
  // the raw gamepass price the buyer sets themselves. Both are resolved here so
  // a tampered client can never pick its own price.
  const taxMode: GamepassTaxMode = input.taxMode ?? "cover";
  const gamepass = input.kind === "gamepass" ? gamepassQuote(taxMode, input.robuxAmount) : null;
  const premiumMonths = input.kind === "premium" ? input.robuxAmount : null;

  if (
    input.kind !== "gamepass" &&
    input.kind !== "premium" &&
    (input.robuxAmount < bounds.minRobux ||
      input.robuxAmount > bounds.maxRobux ||
      input.robuxAmount % bounds.step !== 0)
  ) {
    return {
      ok: false,
      code: "INVALID",
      error: `Jumlah Robux harus kelipatan ${bounds.step} antara ${bounds.minRobux}–${bounds.maxRobux}.`,
    };
  }

  if (gamepass) {
    const raw = gamepass.input;
    if (raw < bounds.minRobux || raw > bounds.maxRobux || raw % bounds.step !== 0) {
      return {
        ok: false,
        code: "INVALID",
        error: `Nominal harus kelipatan ${bounds.step} antara ${bounds.minRobux}–${bounds.maxRobux}.`,
      };
    }
  }

  if (premiumMonths !== null) {
    if (![1, 3, 12].includes(premiumMonths)) {
      return {
        ok: false,
        code: "INVALID",
        error: "Durasi Premium hanya tersedia 1, 3, atau 12 bulan.",
      };
    }
  }

  if (input.kind !== "login" && !usernamePattern.test(input.robloxUsername)) {
    return { ok: false, code: "INVALID", error: "Username Roblox tidak valid." };
  }
  // Login flows accept an email identifier — only real usernames are checked.
  if (input.kind !== "login") {
    const unknownUser = await rejectUnknownRobloxUser(input.robloxUsername);
    if (unknownUser) {
      return { ok: false, code: "INVALID", error: unknownUser };
    }
  }

  // Backup codes are short alphanumeric tokens, comma/space/newline separated.
  let backupCodes: string | undefined;
  if (input.twoFactorBackupCodes) {
    const codes = input.twoFactorBackupCodes
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 10);
    if (
      codes.length === 0 ||
      codes.some((code) => !/^[A-Za-z0-9-]{4,16}$/.test(code))
    ) {
      return {
        ok: false,
        code: "INVALID",
        error: "Format kode cadangan 2FA tidak valid (4–16 karakter alfanumerik per kode).",
      };
    }
    backupCodes = codes.join(" ");
  }

  let credentialsEnc: string | undefined;
  if (input.kind === "login" || input.kind === "premium") {
    if (!input.password) {
      return { ok: false, code: "INVALID", error: "Password akun Roblox wajib diisi." };
    }
    // Fail cleanly instead of 500ing when the server key is misconfigured.
    if (!hasEncryptionKey()) {
      return {
        ok: false,
        code: "PAYMENT_FAILED",
        error: "Layanan kredensial belum dikonfigurasi. Hubungi admin.",
      };
    }
    credentialsEnc = encryptCredentials({
      username: input.robloxUsername,
      password: input.password,
      parentalPin: input.parentalPin,
      twoFactorBackupCodes: backupCodes,
    });
  }

  const rates = await getActiveOrderRates();
  // The gamepass rate depends on who swallows Roblox's 30% cut — the same
  // tax mode the client quoted with, chosen server-side from the raw input.
  const config = robuxOrderConfig(input.kind, rates, taxMode);
  const subtotal = gamepass
    ? gamepassOrderPrice(config, gamepass)
    : premiumMonths !== null
      ? premiumSubtotal(config.rate, premiumMonths)
      : robuxOrderPrice(config, input.robuxAmount);

  let promoCut = 0;
  if (input.promoCode) {
    const cut = await resolvePromoCut(input.promoCode, subtotal);
    if (cut === null) {
      return { ok: false, code: "INVALID", error: "Kode promo tidak valid atau kedaluwarsa." };
    }
    promoCut = cut;
  }

  const total = Math.max(MIN_TOTAL, subtotal + config.adminFee - promoCut);

  const buyer = await db.user.findUnique({
    where: { id: buyerId },
    select: { username: true, email: true, whatsapp: true },
  });

  const base = {
    buyerId,
    kind: input.kind === "premium" ? "premium" : `robux_${input.kind}`,
    unitPrice: subtotal,
    platformFee: config.adminFee,
    total,
    quantity: 1,
    robuxAmount: gamepass ? gamepass.netRobux : input.robuxAmount,
    robloxUsername: input.robloxUsername,
    credentialsEnc,
    gamepassUrl: input.gamepassUrl,
    buyerNote: input.buyerNote,
    promoCode: input.promoCode,
    itemName: gamepass
      ? `${gamepass.netRobux} Robux via Gamepass (${gamepass.mode === "cover" ? "pajak ditanggung" : "pajak ditanggung pembeli"
      })`
      : input.kind === "premium"
        ? `Roblox Premium ${input.robuxAmount} bulan`
        : `${input.robuxAmount} Robux (${input.kind})`,
  };

  if (input.paymentMethod === "saldo") {
    return persistWalletOrder(base);
  }

  return persistOrder({
    ...base,
    paymentMethod: input.paymentMethod,
    customerName: buyer?.username ?? "Pembeli",
    customerEmail: buyer?.email ?? "",
    customerPhone: buyer?.whatsapp ?? undefined,
  });
}

/** Sim-mode settle: pushes the order through the shared notification machine. */
export async function settleSimPayment(orderCode: string): Promise<
  { ok: true; alreadyProcessed?: boolean } | { ok: false; error: string }
> {
  if (!isSimMode()) {
    return { ok: false, error: "Simulasi hanya tersedia dalam mode sim." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Silakan masuk terlebih dahulu." };
  }

  // Wallet top-ups settle through the same sim screen — they are not orders,
  // so they credit the ledger directly instead of the order state machine.
  if (typeof orderCode === "string" && orderCode.startsWith("TU-")) {
    const topUp = await db.topUp.findUnique({
      where: { code: orderCode },
      select: { userId: true, amount: true, fee: true, status: true, expiresAt: true },
    });
    if (!topUp) return { ok: false, error: "Top-up tidak ditemukan." };
    if (topUp.userId !== user.id) return { ok: false, error: "Kamu tidak memiliki akses ke tagihan ini." };
    if (topUp.status === "credited") return { ok: true, alreadyProcessed: true };
    if (topUp.expiresAt && topUp.expiresAt < new Date()) {
      return { ok: false, error: "Jendela pembayaran sudah kedaluwarsa." };
    }
    const credited = await creditTopUp({
      userId: user.id,
      code: orderCode,
      amount: topUp.amount,
      settledByGateway: true,
    });
    if (!credited) return { ok: false, error: "Top-up ini sudah tidak bisa dibayar." };
    await notifyTopUpCredited(user.id, orderCode, topUp.amount);
    revalidatePath("/dompet");
    return { ok: true };
  }

  if (typeof orderCode !== "string" || !/^BX-[A-Z0-9]{6}$/.test(orderCode)) {
    return { ok: false, error: "Kode order tidak valid." };
  }

  const order = await db.order.findUnique({
    where: { code: orderCode },
    select: { id: true, buyerId: true, status: true, payment: { select: { amount: true, status: true, expiresAt: true } } },
  });
  if (!order || !order.payment) {
    return { ok: false, error: "Order tidak ditemukan." };
  }

  if (order.buyerId !== user.id) {
    return { ok: false, error: "Kamu tidak memiliki akses ke order ini." };
  }

  if (order.status !== "pending_payment") {
    return { ok: true, alreadyProcessed: true };
  }

  if (order.payment.expiresAt && new Date(order.payment.expiresAt) < new Date()) {
    return { ok: false, error: "Invoice pembayaran sudah kedaluwarsa." };
  }

  if (order.payment.status === "settled") {
    return { ok: true, alreadyProcessed: true };
  }

  const result = await applyPaymentNotification({
    orderCode,
    status: "settlement",
    fraudStatus: "accept",
    grossAmount: order.payment.amount,
    raw: { simulated: true, at: new Date().toISOString() },
  });
  if (!result.ok) {
    return { ok: false, error: result.reason ?? "Gagal memproses pembayaran simulasi." };
  }
  return { ok: true, alreadyProcessed: result.alreadyProcessed };
}

/**
 * Buyer-triggered rescue when the gateway webhook never arrived: query the
 * gateway Status API directly and funnel the answer through the same payment
 * state machine webhooks use. Safe to spam — settled/cancelled orders no-op.
 */
export async function reconcilePaymentStatus(orderCode: string): Promise<
  { ok: true; paid: boolean } | { ok: false; error: string }
> {
  if (typeof orderCode !== "string" || !/^BX-[A-Z0-9]{6}$/.test(orderCode)) {
    return { ok: false, error: "Kode order tidak valid." };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "Silakan masuk terlebih dahulu." };
  }
  // Each check hits the gateway Status API — throttle per buyer so a loop
  // cannot burn gateway quota.
  if (!checkThrottle(`reconcile:${user.id}`, 10000)) {
    return { ok: false, error: "Terlalu cepat. Tunggu 10 detik sebelum cek lagi." };
  }

  const order = await db.order.findUnique({
    where: { code: orderCode },
    select: {
      id: true,
      buyerId: true,
      status: true,
      payment: { select: { amount: true, status: true, provider: true, providerOrderId: true } },
    },
  });
  if (!order || !order.payment) {
    return { ok: false, error: "Order tidak ditemukan." };
  }
  if (order.buyerId !== user.id) {
    return { ok: false, error: "Kamu tidak memiliki akses ke order ini." };
  }
  if (order.status !== "pending_payment") {
    return {
      ok: true,
      paid: ["paid", "processing", "shipped", "completed"].includes(order.status),
    };
  }
  if (order.payment.provider === "saldo") {
    return { ok: false, error: "Pesanan saldo langsung lunas. Hubungi admin bila macet." };
  }
  if (isSimMode()) {
    return { ok: false, error: "Mode simulasi. Selesaikan lewat halaman /bayar/sim." };
  }

  // Tripay detail is queried by its `reference` (stored at creation); legacy
  // Midtrans invoices are queried by our order code.
  let fetched: { transactionStatus: string; fraudStatus?: string; grossAmount: number };
  if (order.payment.provider === "tripay") {
    if (!order.payment.providerOrderId) {
      return { ok: false, error: "Referensi gateway hilang. Hubungi admin." };
    }
    try {
      const detail = await fetchTripayDetail(order.payment.providerOrderId);
      fetched = {
        transactionStatus: tripayToMidtransStatus(detail.status),
        grossAmount: detail.amount,
      };
    } catch (error) {
      if (error instanceof TripayNotFoundError) {
        return { ok: false, error: "Gateway belum mengenal tagihan ini. Coba lagi." };
      }
      return { ok: false, error: "Gagal menghubungi Tripay. Coba lagi sebentar lagi." };
    }
  } else {
    try {
      fetched = await fetchMidtransStatus(orderCode);
    } catch {
      return { ok: false, error: "Gagal menghubungi Midtrans. Coba lagi sebentar lagi." };
    }
  }

  const result = await applyPaymentNotification({
    orderCode,
    status: fetched.transactionStatus,
    fraudStatus: fetched.fraudStatus,
    grossAmount: fetched.grossAmount,
    raw: { reconciled: true, at: new Date().toISOString() },
  });
  if (!result.ok) {
    return { ok: false, error: "Status gateway belum bisa diproses. Coba lagi." };
  }

  const fresh = await db.order.findUnique({
    where: { code: orderCode },
    select: { status: true },
  });
  revalidatePath(`/pesanan/${orderCode}`);
  revalidatePath("/pesanan");
  revalidatePath("/dashboard/penjual/order-robux");
  return {
    ok: true,
    paid: fresh ? ["paid", "processing", "shipped", "completed"].includes(fresh.status) : false,
  };
}
