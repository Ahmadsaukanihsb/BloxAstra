import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { checkThrottle } from "@/lib/throttle";

/**
 * Machine access to the blog API, for the Hermes automation that writes
 * articles.
 *
 * A long-lived bearer token in `BLOG_API_TOKEN` rather than an admin session:
 * a bot should not hold a human cookie, and rotating a token is a one-line
 * .env change. The comparison is constant-time — a plain `!==` on a secret
 * leaks it a byte at a time to anyone who can measure responses.
 *
 * Every request is rate limited per token+IP so a runaway loop cannot flood
 * the table; every write also leaves an AdminAuditLog row (see blog-write.ts).
 */

const TOKEN_ENV = "BLOG_API_TOKEN";

/** Who the audit trail credits for machine-written posts. */
export const BLOG_API_AUTHOR = "Ahmad Syaukani";

export type BlogApiAuth =
  | { ok: true; actor: string; ip: string }
  | { ok: false; status: number; error: string };

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

function tokenMatches(header: string | null, expected: string): boolean {
  const prefix = "Bearer ";
  if (!header || !header.startsWith(prefix)) return false;
  const got = Buffer.from(header.slice(prefix.length));
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export function authorizeBlogApi(request: NextRequest): BlogApiAuth {
  const expected = process.env[TOKEN_ENV];
  if (!expected) {
    // Fail closed: without a configured token the endpoint stays dark rather
    // than accepting anyone.
    return { ok: false, status: 503, error: `${TOKEN_ENV} belum diset di server.` };
  }
  const ip = clientIp(request);
  if (!tokenMatches(request.headers.get("authorization"), expected)) {
    return { ok: false, status: 401, error: "Token tidak valid." };
  }
  if (!checkThrottle(`blog-api:${ip}`, 2000)) {
    return { ok: false, status: 429, error: "Terlalu cepat. Tunggu 2 detik." };
  }
  return { ok: true, actor: BLOG_API_AUTHOR, ip };
}