import "server-only";

/**
 * Validates required environment variables at startup. Fails fast in
 * production when any critical secret is missing or uses the dev fallback.
 */

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "SESSION_SECRET",
  "PAYMENT_PROVIDER",
  "NEXT_PUBLIC_SITE_URL",
  "ENCRYPTION_KEY",
  // Needed so production never runs the WhatsApp flow in sim mode, where the
  // OTP is returned to the caller. This is the token for our own Baileys bot
  // (WA_BOT_URL); see actions/whatsapp.ts and wa-bot/bot.mjs.
  "WA_BOT_TOKEN",
  // The sweep worker (escrow auto-release, payment expiry, pool/idle refunds)
  // is triggered with this secret from a Windows Scheduled Task. Without it in
  // production the route answers 403 and nothing ever sweeps.
  "CRON_SECRET",
  // Bot protection on the auth forms; absent, the site quietly loses it.
  "TURNSTILE_SECRET_KEY",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
] as const;

const DEV_FALLBACKS: Record<string, string> = {
  SESSION_SECRET: "dev-only-change-me-to-a-long-random-string-32-bytes-min",
};

let validated = false;

export function validateEnv(): void {
  if (validated) return;

  // `next build` collects page data with NODE_ENV=production but WITHOUT
  // production secrets (it reads the local .env). Failing here would make
  // every build require live keys; the running server still validates on
  // boot because that is a fresh process with validated=false.
  if (process.env.NEXT_PHASE === "phase-production-build") {
    validated = true;
    return;
  }

  const isProd = process.env.NODE_ENV === "production";
  const missing: string[] = [];
  const weak: string[] = [];

  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
      continue;
    }
    // Reject known dev fallbacks in production.
    if (isProd && DEV_FALLBACKS[key] === value) {
      weak.push(key);
    }
    // Session secret must be >= 32 chars.
    if (key === "SESSION_SECRET" && value.length < 32) {
      weak.push(key);
    }
    // Encryption key must be 64 hex chars.
    if (key === "ENCRYPTION_KEY" && !/^[0-9a-fA-F]{64}$/.test(value)) {
      weak.push(key);
    }
  }

  if (
    isProd &&
    process.env.PAYMENT_PROVIDER !== "midtrans" &&
    process.env.PAYMENT_PROVIDER !== "tripay"
  ) {
    throw new Error(
      `Production PAYMENT_PROVIDER must be "midtrans" or "tripay". Current value: "${process.env.PAYMENT_PROVIDER}". ` +
        `Sim mode is not allowed in production because orders can be settled for free.`,
    );
  }

  // Gateway keys are otherwise only lazy-checked inside their accessors,
  // which throw mid-request. Fail fast here instead so a misconfigured
  // deploy never boots with a dead payment pipeline.
  if (process.env.PAYMENT_PROVIDER === "midtrans") {
    for (const key of ["MIDTRANS_SERVER_KEY", "MIDTRANS_CLIENT_KEY", "MIDTRANS_IS_PRODUCTION"] as const) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }
  if (process.env.PAYMENT_PROVIDER === "tripay") {
    for (const key of ["TRIPAY_API_KEY", "TRIPAY_PRIVATE_KEY", "TRIPAY_MERCHANT_CODE"] as const) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  // Dev is allowed to boot unconfigured: session/credentials modules carry
  // explicit dev fallbacks and the sim payment provider needs no keys. Only
  // production refuses to start with a gap.
  if (missing.length > 0) {
    if (!isProd) {
      console.warn(
        `[env] missing (dev, continuing): ${missing.join(", ")}. See .env.example.`,
      );
    } else {
      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. ` +
          `Copy .env.example to .env and fill in the values.`,
      );
    }
  }

  // NOTE (verified 2026-10-11 by probing both Midtrans environments): key
  // prefixes no longer reliably indicate sandbox (SB-) vs production — a
  // live key without SB- authenticated fine against sandbox. So presence is
  // all we gate on here; a wrong-environment key surfaces as a gateway 401
  // at checkout time. Do NOT re-add prefix heuristics without re-probing.

  // Weak keys are only fatal in production; dev may run on the documented
  // fallback secrets without being blocked.
  if (weak.length > 0 && isProd) {
    throw new Error(
      `Weak or invalid environment variables in production: ${weak.join(", ")}. ` +
        `Generate strong secrets before deploying.`,
    );
  }

  validated = true;
}
