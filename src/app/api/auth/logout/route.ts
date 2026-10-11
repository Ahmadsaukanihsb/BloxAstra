import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requestOrigin } from "@/lib/site";

/**
 * Force logout endpoint. Clears the sealed session cookie and bounces the
 * browser to /masuk.
 *
 * GET /api/auth/logout
 *
 * Intended to be hit as a plain full-page navigation (a bare <a>), never via
 * next/link — route handlers are not part of the RSC tree.
 */
export async function GET(req: Request) {
  const session = await getSession();
  session.destroy();

  // Redirect against the visitor's real origin. `req.url` is the server's
  // internal address behind the tunnel (localhost:3132), which would strand
  // every logout on an unreachable host.
  const res = NextResponse.redirect(new URL("/masuk", requestOrigin(req.headers)));
  // Explicitly expire the cookie on the response itself.
  res.cookies.set("bloxastra_session", "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
