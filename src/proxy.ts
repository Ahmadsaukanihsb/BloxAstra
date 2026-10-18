import { NextResponse, type NextRequest } from "next/server";
import { BLOG_HOST, BLOG_URL, SITE_URL } from "@/lib/site";

/** Where the shop lives. `SITE_URL` is https://bloxastra.com in production. */
const MAIN_ORIGIN = SITE_URL;
const BLOG_ORIGIN = BLOG_URL;

function mainHost(): string {
  try {
    return new URL(MAIN_ORIGIN).host.toLowerCase();
  } catch {
    return "bloxastra.com";
  }
}

/**
 * Root paths that belong to the shop, never to blog articles. A single path
 * segment equal to one of these routes back to the main site instead of being
 * treated as an article slug. Keep in sync with the routes under `src/app/`.
 */
const MAIN_PATHS = new Set([
  "admin",
  "api",
  "beli",
  "checkout",
  "daftar",
  "dashboard",
  "dompet",
  "katalog",
  "masuk",
  "notifikasi",
  "pesanan",
  "produk",
  "profil",
  "tentang",
  "syarat-layanan",
  "kebijakan-privasi",
  "blog",
]);

const SLUG_PATTERN = /^\/[a-z0-9-]+$/;
const SLUG_OG_PATTERN = /^\/[a-z0-9-]+\/opengraph-image$/;
const BLOG_OG_PATTERN = /^\/blog\/[^/]+\/opengraph-image$/;

/** Next internals, APIs, and files (anything with a dot) bypass host routing. */
function isPassthrough(pathname: string): boolean {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/api/")) return true;
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  return lastSegment.includes(".");
}

/**
 * Permanent redirects that define which host serves what:
 * - www → apex (one canonical shop host, no duplicate-host indexing).
 * - bloxastra.com/blog* → blog.bloxastra.com (the blog moved to a subdomain;
 *   old URLs keep working through a 301).
 * - blog.bloxastra.com/<anything that is not an article> → the shop host, so
 *   nav links to /katalog, /masuk, etc. keep working from the blog.
 */
function hostRedirect(host: string, pathname: string, search: string): string | null {
  const apex = mainHost();
  const wwwHost = apex.startsWith("www.") ? apex : `www.${apex}`;

  if (host === wwwHost) return `${MAIN_ORIGIN}${pathname}${search}`;

  if (host === BLOG_HOST) {
    if (isPassthrough(pathname) || pathname === "/") return null;
    if (pathname.startsWith("/blog")) {
      // Share-card images keep working under their route-shaped path.
      if (BLOG_OG_PATTERN.test(pathname)) return null;
      const rest = pathname.slice("/blog".length);
      return `${BLOG_ORIGIN}${rest || "/"}${search}`;
    }
    if (SLUG_PATTERN.test(pathname) && !MAIN_PATHS.has(pathname.slice(1))) return null;
    if (SLUG_OG_PATTERN.test(pathname)) return null;
    // Everything else on the blog host belongs to the shop.
    return `${MAIN_ORIGIN}${pathname}${search}`;
  }

  if (host === apex && (pathname === "/blog" || pathname.startsWith("/blog/"))) {
    const rest = pathname.slice("/blog".length);
    return `${BLOG_ORIGIN}${rest || "/"}${search}`;
  }

  return null;
}

/** Internal rewrite backing clean article URLs on the blog host. */
function blogRewrite(host: string, pathname: string): string | null {
  if (host !== BLOG_HOST) return null;
  if (isPassthrough(pathname)) return null;
  if (pathname === "/") return "/blog";
  if (pathname.startsWith("/blog")) return null;
  if (SLUG_PATTERN.test(pathname) && !MAIN_PATHS.has(pathname.slice(1))) return `/blog${pathname}`;
  if (SLUG_OG_PATTERN.test(pathname)) return `/blog${pathname}`;
  return null;
}

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
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://challenges.cloudflare.com`
    : `script-src 'self' 'nonce-${nonce}' https://challenges.cloudflare.com`;

  return [
    "default-src 'self'",
    scriptSrc,
    // Tailwind v4 + framer-motion need inline-style parsing.
    "style-src 'self' 'unsafe-inline'",
    // Seller photos / KYC docs are data: URLs; avatars may be remote https:.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // Same-origin server actions + the payment/identity APIs we redirect to,
    // and Turnstile's siteverify-adjacent frames.
    "connect-src 'self' https://app.midtrans.com https://app.sandbox.midtrans.com https://api.midtrans.com https://api.sandbox.midtrans.com https://users.roblox.com https://challenges.cloudflare.com",
    // Turnstile renders its checkbox in an iframe from this origin.
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // Normalize trailing slashes on the blog host so /slug/ never falls through
  // to the shop-host catch-all by accident.
  if (host === BLOG_HOST && pathname.length > 1 && pathname.endsWith("/")) {
    return NextResponse.redirect(`${BLOG_ORIGIN}${pathname.replace(/\/+$/, "")}${search}`, 301);
  }

  const redirectTo = hostRedirect(host, pathname, search);
  if (redirectTo) return NextResponse.redirect(redirectTo, 301);

  const rewritePath = blogRewrite(host, pathname);

  const nonce = makeNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  // The header has to go on the *request* as well, and that is the whole point
  // of this line: Next does not read `x-nonce` at all. It recovers the nonce by
  // parsing the CSP header on the incoming request — see
  // node_modules/next/dist/server/route-modules/app-page/parse-request-headers.js,
  // which reads `content-security-policy` and falls back to the report-only
  // name, then hands the nonce to its own inline and framework scripts.
  //
  // With only the response header set, that parse found nothing, so Next's
  // scripts rendered without a nonce and every one of them was reported as a
  // violation. The app's own tags worked because they read `x-nonce` directly,
  // which is why only some scripts were ever flagged. A request header is not
  // sent to the browser — it is the channel the nonce travels on.
  requestHeaders.set("content-security-policy-report-only", csp);

  let response: NextResponse;
  if (rewritePath) {
    const target = request.nextUrl.clone();
    target.pathname = rewritePath;
    response = NextResponse.rewrite(target, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  response.headers.set("content-security-policy-report-only", csp);
  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals, static files and favicon.
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
