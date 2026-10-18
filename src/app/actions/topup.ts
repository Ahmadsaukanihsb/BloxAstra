"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentFees } from "@/lib/payments";
import { TOPUP_LIMITS, creditTopUp, generateTopUpCode, notifyTopUpCredited } from "@/lib/topup";
import {
  classifyMidtransStatus,
  createSnapTransaction,
  fetchMidtransStatus,
  isSimMode,
  MidtransNotFoundError,
  retiredTopUpStatus,
} from "@/lib/midtrans";
import {
  createTripayTransaction,
  fetchTripayDetail,
  isTripayMode,
  tripayToMidtransStatus,
  TripayNotFoundError,
} from "@/lib/tripay";
import { checkThrottle } from "@/lib/throttle";
import { formatIDR } from "@/lib/format";

export type TopUpActionResult =
  | { ok: true; checkoutUrl: string; code: string }
  | { ok: false; code: "LOGIN" | "INVALID" | "PAYMENT_FAILED"; error: string };

const topUpSchema = z.object({
  amount: z
    .number()
    .int()
    .min(TOPUP_LIMITS.min, `Minimum top-up ${formatIDR(TOPUP_LIMITS.min)}.`)
    .max(TOPUP_LIMITS.max, `Maksimum top-up ${formatIDR(TOPUP_LIMITS.max)} sekali transaksi.`),
  paymentMethod: z.enum(["qris", "va", "ewallet"]),
});

/** Create a wallet top-up and return its gateway checkout URL. */
export async function createTopUp(rawInput: unknown): Promise<TopUpActionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, code: "LOGIN", error: "Masuk dulu untuk top-up." };
  }
  if (!checkThrottle(`topup:${user.id}`, 5000)) {
    return { ok: false, code: "INVALID", error: "Terlalu cepat. Tunggu 5 detik sebelum top-up lagi." };
  }

  const parsed = topUpSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID",
      error: parsed.error.issues[0]?.message ?? "Nominal tidak valid.",
    };
  }
  const { amount, paymentMethod } = parsed.data;

  const fees = await getPaymentFees();
  const fee = fees[paymentMethod] ?? 0;
  const total = amount + fee;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateTopUpCode();
    try {
      await db.topUp.create({
        data: {
          userId: user.id,
          code,
          amount,
          fee,
          paymentMethod,
          provider: isSimMode() ? "sim" : isTripayMode() ? "tripay" : "midtrans",
          expiresAt,
        },
      });

      try {
        // Tripay is the live gateway (method → explicit channel); Midtrans
        // only serves invoices minted before the switch.
        const checkout = isTripayMode()
          ? await createTripayTransaction({
              orderId: code,
              grossAmount: total,
              itemName: `Top-up saldo ${formatIDR(amount)}`,
              customerName: user.username,
              customerEmail: user.email,
              customerPhone: user.whatsapp ?? undefined,
              paymentMethod,
              // A TU- code has no order room — send Tripay back to the
              // wallet, where the invoice and the Cek status button live.
              returnPath: "/dompet",
            }).then((result) => ({ redirectUrl: result.redirectUrl, providerRef: result.reference }))
          : await createSnapTransaction({
              orderId: code,
              grossAmount: total,
              itemName: `Top-up saldo ${formatIDR(amount)}`,
              customerName: user.username,
              customerEmail: user.email,
              // A TU- code has no order room — send Snap back to the wallet,
              // where the invoice and the Cek status button live.
              returnPath: "/dompet",
            }).then((result) => ({ redirectUrl: result.redirectUrl, providerRef: result.token }));
        await db.topUp.update({
          where: { code },
          data: {
            checkoutUrl: checkout.redirectUrl,
            providerToken: checkout.providerRef,
            providerOrderId: checkout.providerRef,
          },
        });
        return { ok: true, checkoutUrl: checkout.redirectUrl, code };
      } catch (snapError) {
        // Release the pending row so the buyer can retry cleanly.
        await db.topUp.update({ where: { code }, data: { status: "failed" } }).catch(() => undefined);
        if (
          snapError instanceof Error &&
          (/Snap 4\d\d:/.test(snapError.message) ||
            /Tripay create (4\d\d|ditolak)/.test(snapError.message))
        ) {
          console.error("createTopUp failed", snapError);
          return {
            ok: false,
            code: "PAYMENT_FAILED",
            error: "Gateway menolak permintaan. Coba metode lain atau hubungi admin.",
          };
        }
        lastError = snapError;
        continue;
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "P2002") {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  console.error("createTopUp failed", lastError);
  return {
    ok: false,
    code: "PAYMENT_FAILED",
    error: "Gagal membuat tagihan top-up. Coba lagi sebentar lagi.",
  };
}

/**
 * Ask the gateway what happened to a top-up and apply the answer.
 *
 * This is the buyer's only route back to money that a webhook never credited,
 * so the gateway is always the authority: it runs for `pending`, `expired`
 * AND `failed` invoices, and a settled answer credits even a row an earlier
 * notification wrongly retired. Safe to spam.
 */
export async function reconcileTopUp(code: string): Promise<
  { ok: true; credited: boolean } | { ok: false; error: string }
> {
  if (typeof code !== "string" || !/^TU-[A-Z0-9]{6}$/.test(code)) {
    return { ok: false, error: "Kode top-up tidak valid." };
  }
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Masuk dulu." };
  if (!checkThrottle(`reconcile-topup:${user.id}`, 10000)) {
    return { ok: false, error: "Terlalu cepat. Tunggu 10 detik sebelum cek lagi." };
  }

  const topUp = await db.topUp.findUnique({
    where: { code },
    select: {
      userId: true,
      amount: true,
      fee: true,
      status: true,
      expiresAt: true,
      creditedAt: true,
      provider: true,
      providerOrderId: true,
    },
  });
  if (!topUp) return { ok: false, error: "Top-up tidak ditemukan." };
  if (topUp.userId !== user.id) return { ok: false, error: "Bukan milik akun ini." };
  if (topUp.status === "credited" || topUp.creditedAt) {
    return { ok: true, credited: true };
  }

  const expiredLocally = Boolean(topUp.expiresAt && topUp.expiresAt.getTime() < Date.now());

  if (isSimMode()) {
    // No gateway in sim mode — settle locally so the demo flow still works,
    // but only inside the payment window.
    if (expiredLocally) {
      await db.topUp.updateMany({
        where: { code, status: "pending" },
        data: { status: "expired" },
      });
      return { ok: false, error: "Tagihan top-up kedaluwarsa. Buat lagi bila belum membayar." };
    }
    const credited = await creditTopUp({ userId: user.id, code, amount: topUp.amount });
    if (credited) await notifyTopUpCredited(user.id, code, topUp.amount);
    revalidatePath("/dompet");
    return { ok: true, credited };
  }

  let fetched: { transactionStatus: string; fraudStatus?: string; grossAmount: number };
  // Tripay detail is queried by its `reference` (stored at creation); legacy
  // Midtrans top-ups are queried by the TU- code itself.
  if (topUp.provider === "tripay") {
    if (!topUp.providerOrderId) {
      return { ok: false, error: "Referensi gateway hilang. Hubungi admin." };
    }
    try {
      const detail = await fetchTripayDetail(topUp.providerOrderId);
      fetched = {
        transactionStatus: tripayToMidtransStatus(detail.status),
        grossAmount: detail.amount,
      };
    } catch (error) {
      if (error instanceof TripayNotFoundError) {
        if (expiredLocally) {
          await db.topUp.updateMany({
            where: { code, status: "pending" },
            data: { status: "expired" },
          });
          return { ok: false, error: "Tagihan top-up kedaluwarsa. Buat lagi bila belum membayar." };
        }
        return { ok: true, credited: false };
      }
      return { ok: false, error: "Gagal menghubungi Tripay. Coba lagi sebentar lagi." };
    }
  } else {
    try {
      fetched = await fetchMidtransStatus(code);
    } catch (error) {
      if (error instanceof MidtransNotFoundError) {
        // The buyer never opened the Snap page, so nothing was charged.
        if (expiredLocally) {
          await db.topUp.updateMany({
            where: { code, status: "pending" },
            data: { status: "expired" },
          });
          return { ok: false, error: "Tagihan top-up kedaluwarsa. Buat lagi bila belum membayar." };
        }
        return { ok: true, credited: false };
      }
      return { ok: false, error: "Gagal menghubungi Midtrans. Coba lagi sebentar lagi." };
    }
  }

  const verdict = classifyMidtransStatus(fetched.transactionStatus, fetched.fraudStatus);
  if (verdict === "settled") {
    if (fetched.grossAmount !== topUp.amount + topUp.fee) {
      return { ok: false, error: "Nominal dari gateway tidak cocok. Hubungi admin." };
    }
    const credited = await creditTopUp({
      userId: user.id,
      code,
      amount: topUp.amount,
      settledByGateway: true,
    });
    if (credited) await notifyTopUpCredited(user.id, code, topUp.amount);
    revalidatePath("/dompet");
    return { ok: true, credited };
  }

  // Still unpaid on the gateway's side: keep the invoice honest.
  if (verdict === "retired") {
    await db.topUp.updateMany({
      where: { code, status: "pending" },
      data: { status: retiredTopUpStatus(fetched.transactionStatus) },
    });
    return { ok: false, error: "Pembayaran dibatalkan atau kedaluwarsa. Buat top-up baru." };
  }
  if (expiredLocally) {
    await db.topUp.updateMany({
      where: { code, status: "pending" },
      data: { status: "expired" },
    });
    return { ok: false, error: "Tagihan top-up kedaluwarsa. Buat lagi bila belum membayar." };
  }
  return { ok: true, credited: false };
}
