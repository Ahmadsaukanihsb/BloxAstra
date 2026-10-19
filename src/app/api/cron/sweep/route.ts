import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSweep } from "@/lib/sweep";

/**
 * Sweep worker: releases shipped orders past their confirm window and cancels
 * pending payments past their billing window.
 *
 * Protect with CRON_SECRET (`Authorization: Bearer <secret>`). Without the
 * secret the route only responds outside production (local testing).
 */

/** Constant-time compare — a plain `!==` leaks the secret byte by byte. */
function authorize(header: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  const got = Buffer.from(header ?? "");
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (!authorize(req.headers.get("authorization"), secret)) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 403 });
  }

  const result = await runSweep();
  return NextResponse.json({ ok: true, ...result });
}
