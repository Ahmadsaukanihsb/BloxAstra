import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sealSecret } from "@/lib/session";

/**
 * Minimal OAuth 2.0 Authorization Code + PKCE helpers for Discord and Google.
 * No external SDK — we talk to the providers' token/userinfo endpoints with
 * plain fetch so the surface stays auditable and dependency-free.
 */

export type OAuthProvider = "discord" | "google";

interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3123";
}

export function redirectUri(provider: OAuthProvider): string {
  return `${baseUrl()}/api/auth/callback/${provider}`;
}

export function isOAuthConfigured(provider: OAuthProvider): boolean {
  const config = providerConfig(provider);
  return Boolean(config.clientId && config.clientSecret);
}

export function providerConfig(provider: OAuthProvider): ProviderConfig {
  if (provider === "discord") {
    return {
      clientId: process.env.DISCORD_CLIENT_ID ?? "",
      clientSecret: process.env.DISCORD_CLIENT_SECRET ?? "",
      authUrl: "https://discord.com/oauth2/authorize",
      tokenUrl: "https://discord.com/api/oauth2/token",
      userInfoUrl: "https://discord.com/api/users/@me",
      scopes: ["identify", "email"],
    };
  }
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  };
}

export interface OAuthProfile {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  id_token?: string;
}

/** Build the authorize URL with a random state + PKCE code_verifier. */export function buildAuthorizeUrl(provider: OAuthProvider): {
  url: string;
  state: string;
  codeVerifier: string;
} {
  const config = providerConfig(provider);
  const state = randomBytes(16).toString("hex");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri(provider),
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  // Google requires prompt=select_account for a clean account chooser.
  if (provider === "google") params.set("prompt", "select_account");

  return { url: `${config.authUrl}?${params.toString()}`, state, codeVerifier };
}

/** Exchange an authorization code for an access token. */
export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
  codeVerifier: string,
): Promise<string> {
  const config = providerConfig(provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(provider),
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${provider}): ${res.status}`);
  }
  const json = (await res.json()) as TokenResponse;
  return json.access_token;
}

/** Fetch the authenticated user's profile from the provider's userinfo endpoint. */
export async function fetchProfile(
  provider: OAuthProvider,
  accessToken: string,
): Promise<OAuthProfile> {
  const config = providerConfig(provider);
  const res = await fetch(config.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`UserInfo fetch failed (${provider}): ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;

  if (provider === "discord") {
    const verified = data.verified === true;
    return {
      provider,
      providerUserId: String(data.id),
      email: typeof data.email === "string" && verified ? data.email : null,
      name: typeof data.global_name === "string" ? data.global_name : null,
      avatarUrl:
        typeof data.avatar === "string"
          ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
          : null,
    };
  }

  const verified = data.email_verified === true;
  return {
    provider,
    providerUserId: String(data.sub),
    email: typeof data.email === "string" && verified ? data.email : null,
    name: typeof data.name === "string" ? data.name : null,
    avatarUrl: typeof data.picture === "string" ? data.picture : null,
  };
}

/** Derive a unique, readable username from a display name / email. */
export function deriveUsername(seed: string, taken: (candidate: string) => Promise<boolean>): Promise<string> {
  const base =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 16) || "user";

  const tryOne = async (candidate: string): Promise<string> => {
    let out = candidate;
    for (let i = 0; i < 50; i += 1) {
      if (!(await taken(out))) return out;
      out = `${candidate}${Math.floor(Math.random() * 900 + 100)}`;
    }
    return `${candidate}${Date.now().toString(36).slice(-4)}`;
  };

  return tryOne(base);
}

/**
 * HMAC-seal the OAuth state cookie payload. The cookie is httpOnly already,
 * but sealing also defeats fixation: an attacker who plants a cookie value
 * cannot forge a valid seal without SESSION_SECRET.
 */
export function sealOAuthState(payload: string): string {
  const sig = createHmac("sha256", sealSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

/** Returns the payload, or null when the seal is missing/forged. */
export function unsealOAuthState(sealed: string): string | null {
  const idx = sealed.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = sealed.slice(0, idx);
  const sig = sealed.slice(idx + 1);
  const expected = createHmac("sha256", sealSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}
