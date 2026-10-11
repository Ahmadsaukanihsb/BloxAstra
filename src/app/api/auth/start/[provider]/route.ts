import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { buildAuthorizeUrl, isOAuthConfigured, sealOAuthState, type OAuthProvider } from "@/lib/oauth";
import { requestOrigin } from "@/lib/site";

const OAUTH_COOKIE = "bloxastra_oauth";

/**
 * Starts the OAuth flow: issues a signed-in cookie holding { state, codeVerifier }
 * then 302s the browser to the provider's authorize endpoint.
 *
 * `?mode=link` starts an account-linking flow instead of login: the caller must
 * already be logged in, and the provider account gets attached to the current
 * user on callback. The link target user id is sealed inside the state cookie
 * so a session swap mid-flow cannot retarget the link.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  // Bounce back to the visitor's real origin, never the server's internal one.
  const origin = requestOrigin(req.headers);
  if (provider !== "discord" && provider !== "google") {
    return NextResponse.redirect(new URL("/masuk", origin));
  }

  const typed = provider as OAuthProvider;
  if (!isOAuthConfigured(typed)) {
    return NextResponse.redirect(new URL("/masuk?error=oauth_disabled", origin));
  }

  const linkMode = new URL(req.url).searchParams.get("mode") === "link";
  let linkUserId: string | undefined;
  if (linkMode) {
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.redirect(new URL("/masuk", origin));
    }
    linkUserId = session.userId;
  }

  const { url, state, codeVerifier } = buildAuthorizeUrl(typed);
  const res = NextResponse.redirect(url);
  res.cookies.set(
    OAUTH_COOKIE,
    sealOAuthState(JSON.stringify({ provider: typed, state, codeVerifier, linkUserId })),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600, // 10 minutes to complete the redirect dance
    },
  );
  return res;
}
