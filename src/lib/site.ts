export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);

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
export function requestOrigin(headers: Headers): string {
  const first = (value: string | null) => value?.split(",")[0]?.trim() || undefined;
  const host = first(headers.get("x-forwarded-host")) ?? first(headers.get("host"));
  if (!host) return SITE_URL;

  const forwardedProto = first(headers.get("x-forwarded-proto"));
  const proto =
    forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : /^(localhost|127\.|0\.0\.0\.0|\[::1\])(:\d+)?$/.test(host)
        ? "http"
        : "https";
  return `${proto}://${host}`;
}
