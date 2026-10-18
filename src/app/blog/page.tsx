import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { absoluteUrl } from "@/lib/site";
import { blogPostPath, getBlogPosts } from "@/lib/blog";
import { FeaturedBlogCard, BlogCard } from "@/components/blog/blog-cards";
import { ButtonLink } from "@/components/ui/button";

const TITLE = "Blog Blox Astra";
const DESCRIPTION =
  "Panduan, tips, dan kabar seputar Robux, gamepass, dan Premium Roblox — ditulis untuk pembeli dan penjual di Blox Astra.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/blog",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/**
 * Index blog. Kontennya berasal dari getBlogPosts() yang di-cache dengan tag
 * `blog`, jadi halaman ini bisa dirender statis dan tetap segar begitu admin
 * menerbitkan artikel (action-nya memanggil updateTag("blog")).
 */
export default async function BlogIndexPage() {
  await connection();
  const posts = await getBlogPosts();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const [featured, ...rest] = posts;

  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: TITLE,
            url: absoluteUrl("/blog"),
            inLanguage: "id-ID",
            publisher: { "@type": "Organization", name: "Blox Astra" },
            blogPost: posts.slice(0, 20).map((post) => ({
              "@type": "BlogPosting",
              headline: post.title,
              url: absoluteUrl(blogPostPath(post.slug)),
              ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
            })),
          }),
        }}
      />

      <header className="flex max-w-[70ch] flex-col gap-3">
        <span className="eyebrow text-astra-ink">Blog</span>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-[44px] md:leading-[1.08]">
          Panduan &amp; kabar Robux dari Blox Astra
        </h1>
        <p className="text-[15px] leading-relaxed text-ink-dim">
          Cara beli Robux dengan aman, seluk-beluk gamepass dan Premium, sampai tips menghindari
          penipuan — semuanya ditulis supaya transaksimu di Roblox berjalan tanpa drama.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-10 rounded-card border border-dashed border-line-strong bg-paper/60 p-10 text-center">
          <p className="font-display text-lg font-extrabold text-ink">Belum ada artikel terbit</p>
          <p className="mx-auto mt-2 max-w-[52ch] text-sm leading-relaxed text-ink-mute">
            Panduan dan tips Robux dari tim Blox Astra akan muncul di sini. Sementara itu, katalog
            tetap bisa dijelajahi.
          </p>
          <ButtonLink href="/katalog" className="mt-5">
            Jelajahi katalog
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          {featured ? <FeaturedBlogCard post={featured} /> : null}
          {rest.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
