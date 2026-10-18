export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

/**
 * The blog lives on its own subdomain (host-routed in `src/proxy.ts` and
 * served by this same app). Absolute URLs for articles, canonicals, and the
 * blog sitemap are built from here so nothing ever links back to the legacy
 * `bloxastra.com/blog` paths.
 */
export const BLOG_URL = (
  process.env.NEXT_PUBLIC_BLOG_URL ?? "https://blog.bloxastra.com"
).replace(/\/+$/, "");

export const BLOG_HOST = (() => {
  try {
    return new URL(BLOG_URL).host.toLowerCase();
  } catch {
    return "blog.bloxastra.com";
  }
})();

export function blogUrl(path: string): string {
  return `${BLOG_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Public origin of the current request, for building redirect targets.
 *
 * Next.js derives `request.url` from the server's own bind address, so behind
 * Cloudflare Tunnel + PM2 it reads as `http://localhost:3132` no matter which
 * hostname the visitor actually used — a redirect built from it strands the
 * user on an unreachable host. Prefer the proxy's `x-forwarded-*` headers
 * (Cloudflare sends both), fall back to `Host`, then to the configured URL.
 */
/** Hosts we will build redirects to. Everything else falls back to SITE_URL. */
function allowedHosts(): string[] {
  const hosts: string[] = [];
  try {
    hosts.push(new URL(SITE_URL).host.toLowerCase());
  } catch {
    /* SITE_URL unparsable — rely on the loopback entries below */
  }
  hosts.push(BLOG_HOST);
  return hosts;
}

/**
 * Public origin of the current request, for building redirect targets.
 *
 * SECURITY: the host is validated against an allowlist (the configured site
 * host, plus loopback for dev). `x-forwarded-host` is attacker-controllable,
 * so trusting it verbatim turned every redirect-using route — OAuth start and
 * callback, logout — into an open redirect, and let a caller spoof the origin
 * that `plus-check` compares against. An unrecognized host now resolves to
 * SITE_URL instead of being echoed back.
 */
export function requestOrigin(headers: Headers): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || undefined;
  const rawHost = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if (!rawHost) return SITE_URL;

  const host = rawHost.toLowerCase();
  const isLoopback = /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host);
  if (!isLoopback && !allowedHosts().includes(host)) {
    // Unknown/forged host: never build a redirect to it.
    return SITE_URL;
  }

  const forwardedProto = first(headers.get("x-forwarded-proto"));
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : isLoopback
        ? "http"
        : "https";
  return `${proto}://${host}`;
}
