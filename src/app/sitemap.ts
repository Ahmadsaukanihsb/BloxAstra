import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getProducts } from "@/lib/catalog";
import { blogPostPath, getBlogPosts } from "@/lib/blog";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: Array<Omit<Entry, "url" | "lastModified"> & { path: string }> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/katalog", changeFrequency: "daily", priority: 0.9 },
  { path: "/beli/robux-username", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/robux-login", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/robux-gamepass", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/premium", changeFrequency: "weekly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tentang", changeFrequency: "monthly", priority: 0.4 },
  { path: "/syarat-layanan", changeFrequency: "monthly", priority: 0.3 },
  { path: "/kebijakan-privasi", changeFrequency: "monthly", priority: 0.3 },
  // /masuk and /daftar are deliberately absent: both carry
  // `robots: { index: false }`, and listing a noindex URL in a sitemap is a
  // contradiction Search Console reports as an error.
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [products, posts] = await Promise.all([getProducts(), getBlogPosts()]);
  // Newest listing mtime, used as the home page's lastmod: the lobby is a
  // live catalogue view, so its real "changed" moment is the newest listing.
  const latestProduct = products.reduce<string | null>(
    (newest, product) => (newest === null || product.updatedAt > newest ? product.updatedAt : newest),
    null,
  );

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(({ path, ...rest }) => ({
    url: absoluteUrl(path),
    // No `lastModified` for the marketing/legal pages: they carry no per-row
    // mtime, and stamping them with the request clock made every crawl look
    // like a fresh edit — which is exactly what makes Google distrust lastmod.
    ...(path === "/" && latestProduct ? { lastModified: new Date(latestProduct) } : {}),
    ...rest,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/produk/${product.slug}`),
    // Real row mtime, not the request clock.
    lastModified: new Date(product.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const blogEntries: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(blogPostPath(post.slug)),
    // Real row mtime so Google sees a fresh date only when the article changed.
    lastModified: new Date(post.updatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticEntries, ...productEntries, ...blogEntries];
}
