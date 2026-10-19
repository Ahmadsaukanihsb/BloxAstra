import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  role?: "buyer" | "seller" | "admin";
  email?: string;
  username?: string;
  /**
   * Generation of this session, mirrored from User.sessionVersion at sign-in.
   * A mismatch means the user logged out everywhere (or changed password)
   * and this cookie is stale — auth treats it as signed out.
   */
  sessionVersion?: number;
}

const isProd = process.env.NODE_ENV === "production";

function sessionPassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (isProd) {
      throw new Error("SESSION_SECRET is not set — refusing to start in production.");
    }
    return "dev-only-change-me-to-a-long-random-string-32-bytes-min";
  }
  if (isProd && secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters in production.");
  }
  return secret;
}

export const sessionOptions: SessionOptions = {
  cookieName: "bloxastra_session",
  password: sessionPassword(),
  ttl: 60 * 60 * 24 * 7, // 7 days
  cookieOptions: {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  },
};

/**
 * Shared HMAC secret for sealing non-session cookies (OAuth state).
 *
 * Mirrors `sessionPassword()`, including its production refusal: a missing
 * secret in production must never silently fall back to the public dev
 * constant, or every OAuth state cookie becomes forgeable.
 */
export function sealSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (isProd) {
    throw new Error("SESSION_SECRET is not set — refusing to seal with the dev fallback in production.");
  }
  return "dev-only-change-me-to-a-long-random-string-32-bytes-min";
}

/** Read (and decrypt) the session cookie for the current request. */
export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/** Destroy the session cookie (logout). */
export async function destroySession() {
  const session = await getSession();
  session.destroy();
}
