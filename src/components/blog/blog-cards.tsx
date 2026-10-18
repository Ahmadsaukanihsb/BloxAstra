import Link from "next/link";
import { blogPostPath, formatBlogDate, type BlogPostSummary } from "@/lib/blog";
import { cx } from "@/lib/cx";
import { IconClock } from "@/components/ui/icons";

/**
 * Card set for the public blog. Covers are either uploaded data URLs or
 * external https images, so they render through a plain <img> — next/image
 * would demand remotePatterns config for the external case and buys nothing
 * for the data-URL one.
 */

export function BlogCover({
  post,
  className,
  eager = false,
}: {
  post: BlogPostSummary;
  className?: string;
  eager?: boolean;
}) {
  if (post.coverImage) {
    return (
      // Covers are data URLs or admin-pasted https URLs; next/image would need
      // remotePatterns config for the latter and buys nothing for the former.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={post.coverImage}
        alt=""
        loading={eager ? "eager" : "lazy"}
        className={cx("h-full w-full object-cover", className)}
      />
    );
  }
  // Placeholder matches the share-card gradient so a cover-less post still
  // reads as the same brand.
  return (
    <div
      aria-hidden
      className={cx(
        "flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#2a0605_0%,#6d1009_55%,#121216_100%)]",
        className,
      )}
    >
      <span className="font-display text-2xl font-extrabold tracking-tight text-white/25">
        Blox Astra
      </span>
    </div>
  );
}

function Tags({ post, className }: { post: BlogPostSummary; className?: string }) {
  if (post.tags.length === 0) return null;
  return (
    <div className={cx("flex flex-wrap gap-1.5", className)}>
      {post.tags.map((tag) => (
        <span
          key={tag}
          className="rounded-tag bg-canvas px-2 py-1 tag text-ink-mute outline outline-1 -outline-offset-1 outline-line"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function Meta({ post, className }: { post: BlogPostSummary; className?: string }) {
  return (
    <div className={cx("flex items-center gap-2.5 text-[12px] text-ink-mute", className)}>
      <span>{post.publishedAt ? formatBlogDate(post.publishedAt) : "Draf"}</span>
      <span className="size-1 rounded-full bg-ink-mute/50" />
      <span className="num flex items-center gap-1">
        <IconClock size={12} />
        {post.readingMinutes} menit baca
      </span>
    </div>
  );
}

export function BlogCard({ post, className }: { post: BlogPostSummary; className?: string }) {
  return (
    <Link href={blogPostPath(post.slug)} className={cx("lift group block h-full", className)}>
      <article className="flex h-full flex-col overflow-hidden rounded-card bg-paper outline outline-1 -outline-offset-1 outline-line transition-[outline-color] duration-300 ease-[var(--ease-astra)] group-hover:outline-astra/50">
        <div className="aspect-[16/9] overflow-hidden">
          <BlogCover
            post={post}
            className="transition-transform duration-500 ease-[var(--ease-astra)] group-hover:scale-[1.03]"
          />
        </div>
        <div className="flex flex-1 flex-col gap-2.5 p-4">
          <Meta post={post} />
          <h3 className="font-display text-[16px] font-extrabold leading-snug tracking-tight text-ink">
            {post.title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-mute">{post.excerpt}</p>
          <Tags post={post} className="mt-auto pt-1.5" />
        </div>
      </article>
    </Link>
  );
}

/** Kartu utama /blog: artikel terbaru, media di kiri saat layar cukup lebar. */
export function FeaturedBlogCard({ post }: { post: BlogPostSummary }) {
  return (
    <Link href={blogPostPath(post.slug)} className="lift group block">
      <article className="grid overflow-hidden rounded-card bg-paper outline outline-1 -outline-offset-1 outline-line transition-[outline-color] duration-300 ease-[var(--ease-astra)] group-hover:outline-astra/50 md:grid-cols-[1.15fr_1fr]">
        <div className="aspect-[16/9] overflow-hidden md:aspect-auto md:min-h-[300px]">
          <BlogCover
            post={post}
            eager
            className="transition-transform duration-500 ease-[var(--ease-astra)] group-hover:scale-[1.02]"
          />
        </div>
        <div className="flex flex-col gap-3.5 p-5 md:p-8">
          <span className="eyebrow text-astra-ink">Terbaru</span>
          <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight text-ink md:text-[26px]">
            {post.title}
          </h2>
          <p className="line-clamp-3 text-[14px] leading-relaxed text-ink-dim">{post.excerpt}</p>
          <Tags post={post} />
          <Meta post={post} className="mt-auto pt-2" />
        </div>
      </article>
    </Link>
  );
}
