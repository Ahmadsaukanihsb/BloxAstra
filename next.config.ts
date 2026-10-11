import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `next build` writes to `.next`, which the running production server reads.
  // Overwriting it under a live process leaves the two out of sync (stale RSC
  // chunks, "resumable slots" replay errors). Set NEXT_DIST_DIR to build a
  // throwaway tree — e.g. `NEXT_DIST_DIR=.next-verify npm run build` — without
  // touching the deployed one.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Next 16 blocks dev-only assets (HMR, chunks) from origins other than the
  // one the server started on. Opening the app over the LAN IP or 127.0.0.1
  // then fails with "Blocked cross-origin request" and half-loaded chunks —
  // which is why pages throw undefined-name errors in dev. Hostnames only.
  allowedDevOrigins: ["127.0.0.1", "169.254.83.107"],
  experimental: {
    // Dispute evidence (3×1.5MB) and KYC documents ride server actions
    // as data URLs — the 1MB default would 413 them.
    serverActions: { bodySizeLimit: "8mb" },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // The repo root sits above this app, so pin the bundler root to the app itself.
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
