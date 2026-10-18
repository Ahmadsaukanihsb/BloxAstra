import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { absoluteUrl, BLOG_HOST, blogUrl } from "@/lib/site";

/**
 * Two hosts, two policies: the shop keeps its private areas out of the index,
 * while the blog subdomain is all public and points crawlers at its own
 * sitemap (the shop sitemap no longer lists any /blog URLs).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = (await headers()).get("host")?.split(":")[0]?.toLowerCase();

  if (host === BLOG_HOST) {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: blogUrl("/sitemap.xml"),
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/checkout", "/dashboard", "/dompet", "/pesanan"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
