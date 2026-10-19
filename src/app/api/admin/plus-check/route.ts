import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { requestOrigin } from "@/lib/site";
import { normalizeRobloxCookie, probePlusEligibility } from "@/lib/roblox-plus";
import { checkThrottle } from "@/lib/throttle";

/**
 * Roblox Plus eligibility check.
 *
 * Why this is a route handler and not a server action: a server action's
 * arguments are logged in full by Next.js in development, so passing a
 * `.ROBLOSECURITY` cookie through one writes a live session token into the dev
 * log on disk — which is exactly the promise this feature makes about not
 * keeping the credential. A request body is not logged by either dev or
 * production, so the cookie stays between the panel, this handler and Roblox.
 *
 * The handler reads; it never claims. No Roblox endpoint creates or activates a
 * consumer subscription, so the claim stays a manual click on roblox.com.
 */

const bodySchema = z.object({
  cookie: z.string().min(1).max(4096),
  username: z.string().trim().max(64).default(""),
});

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    // Deliberately not `requireRole`: an API caller wants a status code, not a
    // redirect to a login page it will try to parse as JSON.
    return fail("Hanya admin yang bisa menjalankan pemeriksaan ini.", 403);
  }

  // This endpoint accepts a session credential, so it refuses cross-origin
  // callers rather than trusting the session cookie alone.
  const origin = request.headers.get("origin");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      return fail("Origin tidak valid.", 403);
    }
    if (originHost !== new URL(requestOrigin(request.headers)).host) {
      return fail("Permintaan lintas-origin ditolak.", 403);
    }
  }

  // Each call fans out to ~7 outbound Roblox requests, so it is throttled like
  // the checkout paths — an admin account (or a stolen admin session) must not
  // be able to hammer Roblox through this endpoint.
  if (!checkThrottle(`plus-check:${user.id}`, 5000)) {
    return fail("Terlalu cepat. Tunggu beberapa detik sebelum memeriksa lagi.", 429);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Body bukan JSON.", 400);
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) return fail("Input tidak valid.", 400);

  const cookie = normalizeRobloxCookie(parsed.data.cookie);
  if (!cookie) {
    return fail("Cookie .ROBLOSECURITY tidak terbaca. Tempel nilai cookie-nya saja, tanpa spasi dan tanpa tanda kutip.", 400);
  }

  const result = await probePlusEligibility({
    cookie,
    expectedUsername: parsed.data.username || null,
  });

  if (!result.ok) {
    return fail(
      `Server tidak bisa membaca data dari Roblox (${result.detail}). Cek manual di browser sebelum menyimpulkan apa pun.`,
      502,
    );
  }

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "0.0.0.0";

  await db.adminAuditLog.create({
    data: {
      actionType: "plus_eligibility.check",
      targetResource: "users",
      targetId: result.report.account ? String(result.report.account.id) : "tidak_terbaca",
      // The cookie is absent by construction: only the verdict and the signals
      // are recorded, which is what a reviewer needs to re-read the decision.
      diffPayload: JSON.stringify({
        verdict: result.report.verdict,
        account: result.report.account?.username ?? null,
        usernameMatches: result.report.usernameMatches,
        signals: result.report.signals,
        offerIds: result.report.offers.map((offer) => offer.id),
      }),
      ipAddress: ip,
      actor: user.email,
    },
  });

  return NextResponse.json(
    { report: result.report },
    { headers: { "cache-control": "no-store" } },
  );
}
