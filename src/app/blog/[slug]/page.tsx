import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { BLOG_URL, blogUrl } from "@/lib/site";
import { blogPostPath, formatBlogDate, getBlogPostBySlug, getBlogPosts } from "@/lib/blog";
import { BlogCard, BlogCover } from "@/components/blog/blog-cards";
import { ButtonLink } from "@/components/ui/button";
import { IconChevronRight, IconClock } from "@/components/ui/icons";

export async function generateMetadata(props: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return { title: "Artikel tidak ditemukan" };
  const url = blogPostPath(post.slug);
  return {
    metadataBase: new URL(BLOG_URL),
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    // No explicit openGraph.images: colocated opengraph-image.tsx supplies the
    // share card, and an explicit list would override it.
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      type: "article",
      ...(post.publishedAt ? { publishedTime: post.publishedAt } : {}),
      modifiedTime: post.updatedAt,
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

function ArticleFallback() {
  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <div className="mx-auto flex max-w-[760px] flex-col gap-6">
        <div className="h-6 w-32 animate-pulse rounded-control bg-canvas" />
        <div className="h-10 w-4/5 animate-pulse rounded-control bg-canvas" />
        <div className="bezel-shell aspect-[16/9] w-full animate-pulse rounded-card" />
      </div>
    </div>
  );
}

export default function BlogPostPage(props: PageProps<"/blog/[slug]">) {
  return (
    <Suspense fallback={<ArticleFallback />}>
      <Article params={props.params} />
    </Suspense>
  );
}

async function Article({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const [post, allPosts] = await Promise.all([getBlogPostBySlug(slug), getBlogPosts()]);
  if (!post) notFound();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const related = allPosts.filter((item) => item.slug !== post.slug).slice(0, 3);
  const publishedLabel = post.publishedAt ? formatBlogDate(post.publishedAt) : null;
  const updatedLabel = formatBlogDate(post.updatedAt);
  const showUpdated = publishedLabel !== null && updatedLabel !== publishedLabel;
  const shareImage = post.coverImage?.startsWith("https://") ? post.coverImage : undefined;

  return (
    <article className="shell pb-24 pt-24 md:pt-28">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt,
            inLanguage: "id-ID",
            mainEntityOfPage: blogPostPath(post.slug),
            ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
            dateModified: post.updatedAt,
            author: { "@type": "Organization", name: "Blox Astra" },
            publisher: { "@type": "Organization", name: "Blox Astra" },
            ...(shareImage ? { image: shareImage } : {}),
          }),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Blog", item: blogUrl("/") },
              {
                "@type": "ListItem",
                position: 2,
                name: post.title,
                item: blogPostPath(post.slug),
              },
            ],
          }),
        }}
      />

      <div className="mx-auto flex max-w-[760px] flex-col gap-8">
        <header className="flex flex-col gap-4">
          <Link
            href={blogUrl("/")}
            className="inline-flex w-fit items-center gap-1 text-[13px] font-bold text-ink-mute transition-colors duration-200 hover:text-astra-ink"
          >
            <IconChevronRight size={13} className="rotate-180" />
            Semua artikel
          </Link>

          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-tag bg-canvas px-2 py-1 tag text-ink-mute outline outline-1 -outline-offset-1 outline-line"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink md:text-[40px]">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-ink-mute">
            {publishedLabel ? <span>Terbit {publishedLabel}</span> : null}
            {showUpdated ? <span>· diperbarui {updatedLabel}</span> : null}
            <span className="num flex items-center gap-1">
              <IconClock size={13} />
              {post.readingMinutes} menit baca
            </span>
          </div>
        </header>

        {post.coverImage ? (
          <div className="overflow-hidden rounded-card outline outline-1 -outline-offset-1 outline-line">
            <div className="aspect-[16/9]">
              <BlogCover post={post} eager />
            </div>
          </div>
        ) : null}

        <div
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.renderedContent }}
        />

        <div className="mt-2 flex flex-col gap-3 rounded-card bg-paper p-6 outline outline-1 -outline-offset-1 outline-line md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="flex flex-col gap-1">
            <p className="font-display text-[16px] font-extrabold text-ink">
              Butuh Robux, gamepass, atau Premium?
            </p>
            <p className="text-[13px] leading-relaxed text-ink-mute">
              Semua transaksi ditahan platform sampai barang diterima — kamu konfirmasi dulu, baru
              dana dilepas ke penjual.
            </p>
          </div>
          <ButtonLink href="/katalog" className="shrink-0">
            Lihat katalog
          </ButtonLink>
        </div>

        {related.length > 0 ? (
          <section className="mt-4 flex flex-col gap-5">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
              Artikel lainnya
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <BlogCard key={item.id} post={item} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
