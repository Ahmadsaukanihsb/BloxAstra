import { headers } from "next/headers";
import { SITE_URL } from "@/lib/site";

/**
 * WebSite JSON-LD. Reads the CSP nonce in its own component so the read
 * stays inside a <Suspense> boundary — calling headers() directly in the
 * root layout would block prerendering of every route.
 */
export async function SiteJsonLd({ description }: { description: string }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Blox Astra",
          url: SITE_URL,
          description,
          inLanguage: "id-ID",
          publisher: { "@type": "Organization", name: "Blox Astra" },
        }),
      }}
    />
  );
}
