"use server";

import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkThrottle } from "@/lib/throttle";
import { isWhatsappSimMode, normalizeMsisdn, sendWhatsappOtp } from "@/lib/whatsapp";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

export type WhatsappOtpResult =
  | { ok: true; simCode?: string }
  | { ok: false; error: string };

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Send a 6-digit verification code to the given WhatsApp number. */
export async function requestWhatsappOtp(rawInput: unknown): Promise<WhatsappOtpResult> {
  const user = await requireUser();
  if (!checkThrottle(`wa-otp:${user.id}`, 60_000)) {
    return { ok: false, error: "Tunggu 1 menit sebelum meminta kode lagi." };
  }

  const parsed = z.object({ phone: z.string().min(8).max(20) }).safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Nomor WhatsApp tidak valid." };
  }
  const phone = normalizeMsisdn(parsed.data.phone);
  if (!phone) {
    return { ok: false, error: "Nomor WhatsApp tidak valid. Gunakan format 08xx." };
  }

  if (!isWhatsappSimMode() && !process.env.FONNTE_TOKEN) {
    return { ok: false, error: "Verifikasi WhatsApp belum dikonfigurasi. Hubungi admin." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  // One live code at a time — older ones die silently.
  await db.whatsappOtp.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await db.whatsappOtp.create({
    data: {
      userId: user.id,
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const delivery = await sendWhatsappOtp(phone, code);
  if (!delivery.sent) {
    return { ok: false, error: delivery.error ?? "Gagal mengirim kode verifikasi." };
  }
  return delivery.sim ? { ok: true, simCode: code } : { ok: true };
}

/** Verify the code and mark the number as verified on the account. */
export async function verifyWhatsappOtp(rawInput: unknown): Promise<WhatsappOtpResult> {
  const user = await requireUser();

  const parsed = z.object({ code: z.string().regex(/^\d{6}$/, "Kode harus 6 digit.") }).safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: "Kode harus 6 digit angka." };
  }

  const otp = await db.whatsappOtp.findFirst({
    where: { userId: user.id, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt.getTime() < Date.now()) {
    if (otp) {
      await db.whatsappOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    }
    return { ok: false, error: "Kode kedaluwarsa. Minta kode baru." };
  }

  const attempts = otp.attempts + 1;
  if (attempts > OTP_MAX_ATTEMPTS) {
    await db.whatsappOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    return { ok: false, error: "Terlalu banyak percobaan. Minta kode baru." };
  }

  if (!safeEqual(hashCode(parsed.data.code), otp.codeHash)) {
    await db.whatsappOtp.update({ where: { id: otp.id }, data: { attempts } });
    return { ok: false, error: `Kode salah. Sisa percobaan: ${OTP_MAX_ATTEMPTS - attempts}.` };
  }

  await db.$transaction([
    db.whatsappOtp.update({ where: { id: otp.id }, data: { consumedAt: new Date() } }),
    db.user.update({
      where: { id: user.id },
      data: { whatsapp: otp.phone, whatsappVerified: true },
    }),
  ]);
  return { ok: true };
}
