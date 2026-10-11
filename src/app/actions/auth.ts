"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { validImageDataUrl } from "@/lib/images";
import { adminUserIds, notifyMany } from "@/lib/notifications";
import {
  loginSchema,
  registerBuyerSchema,
  registerSellerSchema,
} from "@/lib/validation";

export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** Naive in-memory login lock — 5 failures per identifier per 15 minutes.
 *  Sufficient to blunt brute-force on a single instance. Swap for a Redis /
 *  Upstash counter in the Fase 6 hardening pass. */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isLocked(identifier: string): boolean {
  const entry = loginAttempts.get(identifier);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(identifier);
    return false;
  }
  return entry.count >= 5;
}

function recordFailure(identifier: string) {
  const now = Date.now();
  const entry = loginAttempts.get(identifier);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

function clearFailures(identifier: string) {
  loginAttempts.delete(identifier);
}

function fieldErrorsOf(result: {
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}): Record<string, string> | undefined {
  if (!result.error) return undefined;
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function isUniqueCollision(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed) };

  const { identifier, password } = parsed.data;
  // One bucket per account: lowercase + trim so `User@x` vs `user@x` (or the
  // email vs username of the same account) cannot rotate past the lock.
  const bucket = identifier.trim().toLowerCase();
  if (isLocked(bucket)) {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }

  const user = await db.user.findFirst({
    where: {
      OR: [
        { email: identifier.toLowerCase() },
        { username: identifier },
      ],
    },
  });

  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFailure(bucket);
    return { error: "Email/username atau kata sandi salah." };
  }

  clearFailures(bucket);
  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as "buyer" | "seller" | "admin";
  session.email = user.email;
  session.username = user.username;
  await session.save();

  // Buyers land on the catalog; sellers on their dashboard; admins on /admin.
  if (user.role === "seller") redirect("/dashboard/penjual");
  if (user.role === "admin") redirect("/admin");
  redirect("/katalog");
}

export async function registerBuyerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerBuyerSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    whatsapp: formData.get("whatsapp"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed) };

  const { email, username, whatsapp, password } = parsed.data;

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  });
  if (existing) {
    return {
      fieldErrors:
        existing.email === email
          ? { email: "Email sudah terdaftar." }
          : { username: "Username sudah dipakai." },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    user = await db.user.create({
      data: { email, username, passwordHash, whatsapp, role: "buyer" },
    });
  } catch (error) {
    if (isUniqueCollision(error)) {
      return { error: "Email atau username sudah terdaftar. Coba lagi." };
    }
    throw error;
  }

  const session = await getSession();
  session.userId = user.id;
  session.role = "buyer";
  session.email = user.email;
  session.username = user.username;
  await session.save();

  redirect("/katalog");
}

export async function registerSellerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registerSellerSchema.safeParse({
    email: formData.get("email"),
    username: formData.get("username"),
    whatsapp: formData.get("whatsapp"),
    password: formData.get("password"),
    fullName: formData.get("fullName"),
    storeName: formData.get("storeName"),
    idCardImage: formData.get("idCardImage"),
    selfieImage: formData.get("selfieImage"),
    agreed: formData.get("agreed") === "on",
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed) };

  const { email, username, whatsapp, password, fullName, storeName, idCardImage, selfieImage } =
    parsed.data;

  if (!validImageDataUrl(idCardImage, 1_000_000) || !validImageDataUrl(selfieImage, 1_000_000)) {
    return { error: "Dokumen KYC harus gambar PNG/JPEG/GIF/WebP, maksimal 1MB per file." };
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true },
  });
  if (existing) {
    return {
      fieldErrors:
        existing.email === email
          ? { email: "Email sudah terdaftar." }
          : { username: "Username sudah dipakai." },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  let user;
  try {
    // User + profile in ONE transaction: a crash between the two writes can
    // never leave a role=seller orphan with no profile (and no repair path).
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          username,
          passwordHash,
          whatsapp,
          role: "seller",
          kycStatus: "pending",
        },
      });
      await tx.sellerProfile.create({
        data: {
          userId: created.id,
          storeName,
          handle: username,
          tier: 1,
          city: "-",
          bio: "Toko baru — menunggu verifikasi KYC.",
          fullName,
          idCardImage,
          selfieImage,
        },
      });
      return created;
    });
  } catch (error) {
    if (isUniqueCollision(error)) {
      return { error: "Email atau username sudah terdaftar. Coba lagi." };
    }
    throw error;
  }

  await notifyMany(await adminUserIds(), {
    kind: "kyc_submitted",
    title: `KYC baru dari ${username}`,
    body: `Toko "${storeName}" menunggu verifikasi identitas.`,
    link: "/dashboard/admin",
  });

  const session = await getSession();
  session.userId = user.id;
  session.role = "seller";
  session.email = user.email;
  session.username = user.username;
  await session.save();

  redirect("/dashboard/penjual");
}

export async function adminLoginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed) };

  const { identifier, password } = parsed.data;
  if (isLocked(identifier)) {
    return { error: "Terlalu banyak percobaan. Coba lagi dalam 15 menit." };
  }

  const user = await db.user.findFirst({
    where: { email: identifier.toLowerCase(), role: "admin" },
  });

  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    recordFailure(identifier);
    return { error: "Email atau kata sandi salah." };
  }

  clearFailures(identifier);
  const session = await getSession();
  session.userId = user.id;
  session.role = "admin";
  session.email = user.email;
  session.username = user.username;
  await session.save();

  return {};
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/");
}
