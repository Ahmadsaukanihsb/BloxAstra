"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { validImageDataUrl } from "@/lib/images";
import { fetchProviderAvatar } from "@/lib/oauth";

export interface ProfileActionResult {
  ok: boolean;
  error?: string;
}

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username minimal 3 karakter.")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username hanya boleh huruf, angka, dan garis bawah."),
  whatsapp: z.string().trim().min(8, "Nomor WhatsApp tidak valid.").max(20),
});

const passwordSchema = z
  .object({
    current: z.string().min(1, "Isi kata sandi saat ini."),
    next: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter.")
      .max(200)
      .regex(/\d/, "Kata sandi harus mengandung angka."),
  })
  .refine((data) => data.current !== data.next, {
    message: "Kata sandi baru tidak boleh sama dengan yang lama.",
    path: ["next"],
  });

function fail(error: string): ProfileActionResult {
  return { ok: false, error };
}

/** Update the signed-in user's username & WhatsApp. */
export async function updateProfile(rawInput: unknown): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }

  const taken = await db.user.findFirst({
    where: { username: parsed.data.username, id: { not: user.id } },
    select: { id: true },
  });
  if (taken) return fail("Username sudah dipakai akun lain.");

  const current = await db.user.findUnique({
    where: { id: user.id },
    select: { whatsapp: true },
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      username: parsed.data.username,
      whatsapp: parsed.data.whatsapp,
      // A changed number loses its verified stamp until re-verified.
      ...(current && current.whatsapp !== parsed.data.whatsapp
        ? { whatsappVerified: false }
        : {}),
    },
  });
  revalidatePath("/profil");
  return { ok: true };
}

const AVATAR_MAX_BYTES = 500_000;

/** Set or remove the custom profile photo (null removes → provider avatar/initials). */
export async function updateAvatar(rawInput: unknown): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = z.object({ image: z.string().nullable() }).safeParse(rawInput);
  if (!parsed.success) return fail("Input tidak valid.");
  if (parsed.data.image !== null && !validImageDataUrl(parsed.data.image, AVATAR_MAX_BYTES)) {
    return fail("Foto harus PNG/JPG/GIF/WebP maksimal 500KB.");
  }
  await db.user.update({ where: { id: user.id }, data: { avatarImage: parsed.data.image } });
  revalidatePath("/profil");
  // The avatar also shows in the top-nav dropdown, which lives in the root
  // layout — without this the nav keeps the old photo until a hard reload.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change the signed-in user's password (non-OAuth accounts). */
export async function changePassword(rawInput: unknown): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(rawInput);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Input tidak valid.");
  }

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!row?.passwordHash) {
    return fail("Akun ini masuk lewat OAuth. Kelola kata sandi dari penyedia akunmu.");
  }
  const matches = await bcrypt.compare(parsed.data.current, row.passwordHash);
  if (!matches) return fail("Kata sandi saat ini salah.");

  // Changing the password retires every OTHER session (and re-stamps this
  // one) — the whole point of changing it after a scare.
  const passwordHash = await bcrypt.hash(parsed.data.next, 10);
  const bumped = await db.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  const session = await getSession();
  session.sessionVersion = bumped.sessionVersion;
  await session.save();

  revalidatePath("/profil");
  return { ok: true };
}

/** Disconnect a linked OAuth provider (Google/Discord). */
export async function unlinkProvider(rawInput: unknown): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = z.object({ provider: z.enum(["google", "discord"]) }).safeParse(rawInput);
  if (!parsed.success) return fail("Provider tidak valid.");

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, linkedAccounts: { select: { provider: true } } },
  });
  if (!row) return fail("Akun tidak ditemukan.");

  const linked = row.linkedAccounts.some((account) => account.provider === parsed.data.provider);
  if (!linked) return fail("Provider ini memang belum tertaut.");

  // Removing the last login method would lock the user out permanently.
  const remainingProviders = row.linkedAccounts.filter(
    (account) => account.provider !== parsed.data.provider,
  ).length;
  if (!row.passwordHash && remainingProviders === 0) {
    return fail(
      "Ini satu-satunya cara masuk akunmu. Buat kata sandi dulu di bagian Keamanan sebelum melepas tautan.",
    );
  }

  await db.linkedAccount.deleteMany({
    where: { userId: user.id, provider: parsed.data.provider },
  });
  revalidatePath("/profil");
  return { ok: true };
}

/** Adopt a linked provider's photo as the profile picture. */
export async function adoptProviderAvatar(rawInput: unknown): Promise<ProfileActionResult> {
  const user = await requireUser();
  const parsed = z.object({ provider: z.enum(["google", "discord"]) }).safeParse(rawInput);
  if (!parsed.success) return fail("Provider tidak valid.");

  const link = await db.linkedAccount.findFirst({
    where: { userId: user.id, provider: parsed.data.provider },
    select: { avatarUrl: true },
  });
  if (!link) return fail("Provider ini belum tertaut.");
  if (!link.avatarUrl) {
    return fail("Provider tidak menyediakan foto untuk akun ini. Unggah foto manual saja.");
  }

  const dataUrl = await fetchProviderAvatar(link.avatarUrl);
  if (!dataUrl) return fail("Gagal mengambil foto dari provider. Coba lagi sebentar lagi.");

  await db.user.update({ where: { id: user.id }, data: { avatarImage: dataUrl } });
  revalidatePath("/profil");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Sign out every device: bump the session version so old cookies stop valid. */
export async function logoutAllDevices(): Promise<ProfileActionResult> {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  // This device keeps working — re-stamp its cookie with the new version.
  const fresh = await db.user.findUnique({
    where: { id: user.id },
    select: { sessionVersion: true },
  });
  const session = await getSession();
  session.sessionVersion = fresh?.sessionVersion ?? 0;
  await session.save();

  revalidatePath("/profil");
  return { ok: true };
}
