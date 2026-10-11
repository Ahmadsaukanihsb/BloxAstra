import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getProducts } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";

type Entry = MetadataRoute.Sitemap[number];

const STATIC_PAGES: Array<Omit<Entry, "url" | "lastModified"> & { path: string }> = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/katalog", changeFrequency: "daily", priority: 0.9 },
  { path: "/beli/robux-username", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/robux-login", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/robux-gamepass", changeFrequency: "weekly", priority: 0.8 },
  { path: "/beli/premium", changeFrequency: "weekly", priority: 0.8 },
  { path: "/masuk", changeFrequency: "monthly", priority: 0.3 },
  { path: "/daftar", changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const now = new Date();
  const products = await getProducts();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map(({ path, ...rest }) => ({
    url: absoluteUrl(path),
    lastModified: now,
    ...rest,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((product) => ({
    url: absoluteUrl(`/produk/${product.slug}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...productEntries];
}
