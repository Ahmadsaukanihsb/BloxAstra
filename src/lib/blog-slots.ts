/**
 * Pure, client-safe half of the blog module: limits, slug rules, tag parsing,
 * and the path/date formatting shared by the admin panel and the public
 * pages. Split out of `blog.ts` because that file imports the database and
 * `next/cache` — neither of which can travel into a client component.
 */

export const BLOG_TITLE_MAX = 140;
export const BLOG_EXCERPT_MAX = 300;
export const BLOG_CONTENT_MAX = 60_000;
export const BLOG_SLUG_MAX = 80;
export const BLOG_TAG_MAX = 28;
export const BLOG_TAG_COUNT_MAX = 6;
export const BLOG_COVER_MAX_BYTES = 800_000;

export type BlogPostStatus = "draft" | "published";

/** Path publik sebuah artikel — dipakai kartu, sitemap, dan tautan balik. */
export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

/** Bylinedate artikel: "18 Oktober 2026", zona Jakarta seperti seluruh situs. */
export function formatBlogDate(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

/**
 * Judul → slug: huruf kecil, aksen dibuang, apa pun yang bukan a–z/0–9 jadi
 * tanda hubung. Sengaja tidak menangani kata majemuk Indonesia secara khusus;
 * admin tetap bisa menyunting slug di form.
 */
export function slugifyBlogTitle(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, BLOG_SLUG_MAX)
    .replace(/-+$/g, "");
}

export function isValidBlogSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= BLOG_SLUG_MAX && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/** "a, B , a" → ["a", "B"] — dedupe case-insensitive, batasi jumlah & panjang. */
export function parseBlogTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim().slice(0, BLOG_TAG_MAX);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= BLOG_TAG_COUNT_MAX) break;
  }
  return tags;
}

export function serializeBlogTags(tags: string[]): string {
  return tags.join(", ");
}

/**
 * Ringkasan untuk meta description saat admin tidak mengisi excerpt: markdown
 * kasar dibersihkan dulu supaya yang muncul kalimat, bukan `##` dan `**`.
 */
export function deriveBlogExcerpt(content: string, max = 160): string {
  const text = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Estimasi waktu baca (200 kata/menit) — ditampilkan di kartu dan artikel. */
export function blogReadingMinutes(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
