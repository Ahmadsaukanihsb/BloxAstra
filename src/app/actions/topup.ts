"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getPaymentFees } from "@/lib/payments";
import { TOPUP_LIMITS, creditTopUp, generateTopUpCode, notifyTopUpCredited } from "@/lib/topup";
import { createSnapTransaction, fetchMidtransStatus, isSimMode } from "@/lib/midtrans";
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
          provider: isSimMode() ? "sim" : "midtrans",
          expiresAt,
        },
      });

      try {
        const snap = await createSnapTransaction({
          orderId: code,
          grossAmount: total,
          itemName: `Top-up saldo ${formatIDR(amount)}`,
          customerName: user.username,
          customerEmail: user.email,
        });
        await db.topUp.update({
          where: { code },
          data: {
            checkoutUrl: snap.redirectUrl,
            providerToken: snap.token,
            providerOrderId: snap.token,
          },
        });
        return { ok: true, checkoutUrl: snap.redirectUrl, code };
      } catch (snapError) {
        // Release the pending row so the buyer can retry cleanly.
        await db.topUp.update({ where: { code }, data: { status: "failed" } }).catch(() => undefined);
        if (snapError instanceof Error && /Snap 4\d\d:/.test(snapError.message)) {
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
 * Ask the gateway what happened to a pending top-up and apply the answer.
 * Covers the "webhook never arrived" case; safe to spam.
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
    select: { userId: true, amount: true, fee: true, status: true, expiresAt: true },
  });
  if (!topUp) return { ok: false, error: "Top-up tidak ditemukan." };
  if (topUp.userId !== user.id) return { ok: false, error: "Bukan milik akun ini." };
  if (topUp.status !== "pending") {
    return { ok: true, credited: topUp.status === "credited" };
  }
  if (topUp.expiresAt && topUp.expiresAt.getTime() < Date.now()) {
    await db.topUp.updateMany({
      where: { code, status: "pending" },
      data: { status: "expired" },
    });
    return { ok: false, error: "Tagihan top-up kedaluwarsa. Buat lagi bila belum membayar." };
  }
  if (isSimMode()) {
    // No gateway in sim mode — settle locally so the demo flow still works.
    const credited = await creditTopUp({ userId: user.id, code, amount: topUp.amount });
    if (credited) await notifyTopUpCredited(user.id, code, topUp.amount);
    revalidatePath("/dompet");
    return { ok: true, credited };
  }

  let fetched: { transactionStatus: string; fraudStatus?: string; grossAmount: number };
  try {
    fetched = await fetchMidtransStatus(code);
  } catch {
    return { ok: false, error: "Gagal menghubungi Midtrans. Coba lagi sebentar lagi." };
  }
  const settled = fetched.transactionStatus === "settlement" || fetched.transactionStatus === "capture";
  if (!settled || fetched.fraudStatus === "deny") {
    if (["deny", "cancel", "expire"].includes(fetched.transactionStatus)) {
      await db.topUp.updateMany({
        where: { code, status: "pending" },
        data: { status: "failed" },
      });
    }
    return { ok: true, credited: false };
  }
  if (fetched.grossAmount !== topUp.amount + topUp.fee) {
    return { ok: false, error: "Nominal dari gateway tidak cocok. Hubungi admin." };
  }

  const credited = await creditTopUp({ userId: user.id, code, amount: topUp.amount });
  if (credited) await notifyTopUpCredited(user.id, code, topUp.amount);
  revalidatePath("/dompet");
  revalidatePath(`/dompet/topup/${code}`);
  return { ok: true, credited };
}
