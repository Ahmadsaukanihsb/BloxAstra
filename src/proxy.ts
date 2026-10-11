import { NextResponse, type NextRequest } from "next/server";

/** Edge-safe nonce: Web Crypto exists in Edge, Node, and browsers. */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Per-request CSP nonce + report-only Content-Security-Policy.
 *
 * Why report-only first: the policy below is strict (no 'unsafe-inline' for
 * scripts) and any missed inline script would break pages silently in
 * enforce mode. Violations land in /api/csp-report (→ PM2 logs). After a
 * week of clean logs, flip the header name to enforcing (see README).
 *
 * The nonce travels via the x-nonce request header; layout.tsx and
 * produk/[slug]/page.tsx read it for their JSON-LD <script> tags.
 * Next.js applies the same nonce to its own runtime scripts automatically.
 */
function buildCsp(nonce: string): string {
  // Turbopack's dev runtime evaluates module wrappers with eval(); the
  // production build does not. Without this the report-only log drowns in
  // `[csp] script-src blocked=eval` lines and buries the violations actually
  // worth reading. Never widen this outside development.
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}'`;

  return [
    "default-src 'self'",
    scriptSrc,
    // Tailwind v4 + framer-motion need inline-style parsing.
    "style-src 'self' 'unsafe-inline'",
    // Seller photos / KYC docs are data: URLs; avatars may be remote https:.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Same-origin server actions + the payment/identity APIs we redirect to.
    "connect-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://api.midtrans.com https://api.sandbox.midtrans.com https://users.roblox.com",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = makeNonce();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy-report-only", buildCsp(nonce));
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, static files and favicon.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
