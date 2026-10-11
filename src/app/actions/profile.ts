"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { validImageDataUrl } from "@/lib/images";

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
    return fail("Akun ini masuk lewat OAuth — kelola kata sandi dari penyedia akunmu.");
  }
  const matches = await bcrypt.compare(parsed.data.current, row.passwordHash);
  if (!matches) return fail("Kata sandi saat ini salah.");

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.next, 10) },
  });
  revalidatePath("/profil");
  return { ok: true };
}
