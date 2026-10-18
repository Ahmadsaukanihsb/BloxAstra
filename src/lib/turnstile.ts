import "server-only";

/**
 * Cloudflare Turnstile anti-bot verification for the password forms
 * (login + both registers + the dormant admin login).
 *
 * Inactive until configured: without TURNSTILE_SECRET_KEY every check passes
 * so local dev works with zero setup. The moment the secret exists,
 * verification is mandatory — including when Cloudflare itself is
 * unreachable (fail closed: a gateway blip must not become a bot window).
 */

export function turnstileConfigured(): boolean {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile(token: string | null | undefined): Promise<boolean> {
  if (!turnstileConfigured()) return true;
  if (!token || typeof token !== "string" || token.length === 0) return false;
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY as string,
        response: token,
      }),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
