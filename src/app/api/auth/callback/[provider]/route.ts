import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCurrentUser } from "@/lib/auth";
import {
  exchangeCode,
  fetchProfile,
  fetchProviderAvatar,
  isOAuthConfigured,
  unsealOAuthState,
  type OAuthProvider,
} from "@/lib/oauth";
import { deriveUsername } from "@/lib/oauth";
import { requestOrigin } from "@/lib/site";

const OAUTH_COOKIE = "bloxastra_oauth";

/**
 * Error/landing redirects must use the visitor's real origin. `req.url` is the
 * server's internal address behind the Cloudflare tunnel, and the build-time
 * site URL is pinned to the canonical hostname, so either one strands dev and
 * any non-canonical host. The OAuth `redirect_uri` itself stays pinned to the
 * configured site URL — that exact string is registered with the provider.
 */
function fail(code: string, origin: string): NextResponse {
  return NextResponse.redirect(new URL(`/masuk?error=${code}`, origin));
}

interface OAuthCookieState {
  provider: OAuthProvider;
  state: string;
  codeVerifier: string;
  linkUserId?: string;
}

function linkFail(code: string, origin: string): NextResponse {
  return NextResponse.redirect(new URL(`/profil?link_error=${code}`, origin));
}

/**
 * Handles the provider redirect back to us: validates state, exchanges the
 * code, fetches the profile, finds-or-creates a LocalUser, and opens a session.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const origin = requestOrigin(req.headers);
  if (provider !== "discord" && provider !== "google") {
    return fail("bad_provider", origin);
  }

  const typed = provider as OAuthProvider;
  if (!isOAuthConfigured(typed)) {
    return fail("oauth_disabled", origin);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const raw = req.cookies.get(OAUTH_COOKIE)?.value;
  if (!raw || !code || !state) {
    return fail("oauth_state", origin);
  }

  let stored: OAuthCookieState;
  try {
    const payload = unsealOAuthState(raw);
    if (!payload) return fail("oauth_state", origin);
    stored = JSON.parse(payload) as OAuthCookieState;
  } catch {
    return fail("oauth_state", origin);
  }

  if (stored.provider !== typed || stored.state !== state) {
    return fail("oauth_state", origin);
  }

  let accessToken: string;
  let profile;
  try {
    accessToken = await exchangeCode(typed, code, stored.codeVerifier);
    profile = await fetchProfile(typed, accessToken);
  } catch (err) {
    console.error(`[oauth] ${typed} exchange failed:`, err);
    return stored.linkUserId ? linkFail("oauth_exchange", origin) : fail("oauth_exchange", origin);
  }

  // Account-linking flow: attach this provider identity to the user who
  // started the flow. The session must still belong to the same user.
  if (stored.linkUserId) {
    // getCurrentUser enforces the FULL session check (exists, not suspended,
    // sessionVersion still current), so a cookie revoked by "log out of all
    // devices" or a password change cannot complete an account takeover.
    const current = await getCurrentUser();
    if (!current || current.id !== stored.linkUserId) {
      return linkFail("oauth_session", origin);
    }

    const taken = await db.linkedAccount.findUnique({
      where: {
        provider_providerUserId: { provider: typed, providerUserId: profile.providerUserId },
      },
      select: { userId: true },
    });
    if (taken) {
      if (taken.userId === stored.linkUserId) {
        const res = NextResponse.redirect(new URL("/profil?linked=already", origin));
        res.cookies.delete(OAUTH_COOKIE);
        return res;
      }
      return linkFail("taken", origin);
    }

    await db.linkedAccount.create({
      data: {
        userId: stored.linkUserId,
        provider: typed,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });
    // A linked provider photo becomes the profile photo while the user never
    // uploaded their own (a custom upload always wins, never overwritten).
    const linkedAvatar = await fetchProviderAvatar(profile.avatarUrl);
    if (linkedAvatar) {
      await db.user.updateMany({
        where: { id: stored.linkUserId, avatarImage: null },
        data: { avatarImage: linkedAvatar },
      });
    }
    const res = NextResponse.redirect(new URL(`/profil?linked=${typed}`, origin));
    res.cookies.delete(OAUTH_COOKIE);
    return res;
  }

  // Find an existing link, else try to attach by email.
  const existing = await db.linkedAccount.findUnique({
    where: {
      provider_providerUserId: { provider: typed, providerUserId: profile.providerUserId },
    },
    include: { user: { select: { id: true, role: true, email: true, username: true } } },
  });

  let userId: string;
  if (existing) {
    userId = existing.userId;
  } else {
    const byEmail = profile.email
      ? await db.user.findUnique({ where: { email: profile.email }, select: { id: true } })
      : null;

    if (byEmail) {
      userId = byEmail.id;
    } else {
      // Create a brand-new buyer account tied to this OAuth identity.
      const username = await deriveUsername(
        profile.name ?? profile.email?.split("@")[0] ?? typed,
        async (candidate) =>
          Boolean(await db.user.findUnique({ where: { username: candidate }, select: { id: true } })),
      );

      const created = await db.user
        .create({
          data: {
            email: profile.email ?? `${username}@${typed}.oauth`,
            username,
            passwordHash: null, // no password — OAuth-only account
            role: "buyer",
          },
          select: { id: true },
        })
        .catch(async (err: unknown) => {
          // Lost a race on a unique email/username — attach to the winner.
          if (
            typeof err === "object" &&
            err !== null &&
            (err as { code?: string }).code === "P2002"
          ) {
            const byKey = profile.email
              ? await db.user.findUnique({ where: { email: profile.email }, select: { id: true } })
              : null;
            if (byKey) return byKey;
          }
          throw err;
        });
      userId = created.id;
    }

    await db.linkedAccount.create({
      data: {
        userId,
        provider: typed,
        providerUserId: profile.providerUserId,
        email: profile.email,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
      },
    });
  }

  // Keep the stored provider photo fresh, and adopt it as the profile photo
  // while the user never uploaded their own. Best-effort: a failed download
  // never blocks the login (the remote URL fallback in getProfileView stays).
  await db.linkedAccount.updateMany({
    where: { provider: typed, providerUserId: profile.providerUserId },
    data: { avatarUrl: profile.avatarUrl, email: profile.email, name: profile.name },
  });
  const providerAvatar = await fetchProviderAvatar(profile.avatarUrl);
  if (providerAvatar) {
    await db.user.updateMany({
      where: { id: userId, avatarImage: null },
      data: { avatarImage: providerAvatar },
    });
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      suspendedAt: true,
      sessionVersion: true,
    },
  });
  if (!user) return fail("oauth_lookup", origin);
  if (user.suspendedAt) return fail("suspended", origin);

  const session = await getSession();
  session.userId = user.id;
  session.role = user.role as "buyer" | "seller" | "admin";
  session.email = user.email;
  session.username = user.username;
  session.sessionVersion = user.sessionVersion;
  await session.save();

  // Clear the OAuth state cookie and land by role (sellers/admins who
  // linked OAuth go home, everyone else to the catalog).
  const landing =
    user.role === "seller" ? "/dashboard/penjual" : user.role === "admin" ? "/admin" : "/katalog";
  const res = NextResponse.redirect(new URL(landing, origin));
  res.cookies.delete(OAUTH_COOKIE);
  return res;
}
