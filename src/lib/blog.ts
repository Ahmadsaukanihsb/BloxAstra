import { cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { normalizeImageInput } from "@/lib/images";
import {
  BLOG_COVER_MAX_BYTES,
  blogReadingMinutes,
  deriveBlogExcerpt,
  parseBlogTags,
  type BlogPostStatus,
} from "@/lib/blog-slots";

/**
 * Blog data layer.
 *
 * Posts are written by admins from /admin?tab=blog and published on /blog.
 * The point of the blog is organic search traffic, so every reader here is
 * public-facing and cached; the admin panel reads rows through the uncached
 * helpers at the bottom.
 *
 * `content` is markdown rendered by renderBlogMarkdown() straight into
 * dangerouslySetInnerHTML, which is why that renderer escapes first and only
 * then applies a deliberately small whitelist of constructs. Anything the
 * renderer does not understand stays visible as plain text instead of becoming
 * raw HTML.
 *
 * The client-safe half (limits, slug rules, tag parsing) lives in
 * `blog-slots.ts` and is re-exported here so server importers keep one entry
 * point.
 */

export {
  BLOG_CONTENT_MAX,
  BLOG_COVER_MAX_BYTES,
  BLOG_EXCERPT_MAX,
  BLOG_SLUG_MAX,
  BLOG_TAG_COUNT_MAX,
  BLOG_TAG_MAX,
  BLOG_TITLE_MAX,
  blogPostLocalPath,
  blogPostPath,
  blogReadingMinutes,
  deriveBlogExcerpt,
  formatBlogDate,
  isValidBlogSlug,
  parseBlogTags,
  serializeBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog-slots";
export type { BlogPostStatus } from "@/lib/blog-slots";

export type BlogPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage: string | null;
  tags: string[];
  readingMinutes: number;
  publishedAt: string | null;
  updatedAt: string;
};

export type BlogPostDetail = BlogPostSummary & {
  content: string;
  renderedContent: string;
};

export type BlogPostAdminRow = BlogPostDetail & {
  status: BlogPostStatus;
  authorEmail: string | null;
  createdAt: string;
};

// ─────────────────────────── markdown ───────────────────────────

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeBlogHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/** Skema tautan yang boleh jadi href — `javascript:` dan sejenisnya jatuh ke teks biasa. */
const SAFE_LINK = /^(?:https?:\/\/|\/|mailto:)/i;

/**
 * Inline: `code`, **tebal**, *miring*, [teks](tautan). Input harus sudah
 * di-escape. Code span diekstrak lebih dulu supaya isinya tidak ikut ditafsir.
 */
function renderBlogInline(escaped: string): string {
  const codes: string[] = [];
  let out = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  out = out.replace(/\[([^\]\n]+)\]\(([^()\s]+)\)/g, (match, label: string, url: string) => {
    if (!SAFE_LINK.test(url)) return match;
    const external = /^https?:\/\//i.test(url);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${url}"${attrs}>${label}</a>`;
  });
  out = out.replace(/\u0000(\d+)\u0000/g, (_match, index: string) => codes[Number(index)]);
  return out;
}

/**
 * Renderer markdown sadar-batas untuk artikel blog: paragraf, #–####,
 * daftar -/1., kutipan `>`, blok kode ```, dan inline di atas. Semua teks
 * di-escape sebelum ditafsir, jadi HTML mentah di dalam artikel tampil apa
 * adanya — itu yang membuat keluaran fungsi ini aman ditempel ke innerHTML.
 */
export function renderBlogMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  const isBlockStart = (line: string): boolean =>
    /^(#{1,4}\s|```|\s*>|\s*[-*]\s|\s*\d+[.)]\s)/.test(line);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const buffer: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buffer.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(`<pre><code>${escapeBlogHtml(buffer.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderBlogInline(escapeBlogHtml(heading[2].trim()))}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^(?:-{3,}|\*{3,})\s*$/.test(line.trim())) {
      blocks.push("<hr/>");
      i += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buffer: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buffer.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote>${renderBlogInline(escapeBlogHtml(buffer.join("\n"))).replace(/\n/g, "<br/>")}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderBlogInline(escapeBlogHtml(lines[i].replace(/^\s*[-*]\s+/, "")))}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${renderBlogInline(escapeBlogHtml(lines[i].replace(/^\s*\d+[.)]\s+/, "")))}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${renderBlogInline(escapeBlogHtml(paragraph.join("\n"))).replace(/\n/g, "<br/>")}</p>`);
  }

  return blocks.join("\n");
}

// ─────────────────────────── readers ───────────────────────────

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  tags: string;
  status: string;
  publishedAt: Date | null;
  authorEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapSummary(row: BlogRow): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt || deriveBlogExcerpt(row.content),
    coverImage: normalizeImageInput(row.coverImage ?? null, BLOG_COVER_MAX_BYTES),
    tags: parseBlogTags(row.tags),
    readingMinutes: blogReadingMinutes(row.content),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapDetail(row: BlogRow): BlogPostDetail {
  return {
    ...mapSummary(row),
    content: row.content,
    renderedContent: renderBlogMarkdown(row.content),
  };
}

/**
 * Semua artikel terbit, terbaru dulu. Tag `blog` yang sama untuk daftar dan
 * detail: menulis satu artikel membatalkan cache keduanya sekaligus.
 */
export async function getBlogPosts(): Promise<BlogPostSummary[]> {
  "use cache";
  cacheTag("blog");
  const rows = await db.blogPost.findMany({
    where: { status: "published", publishedAt: { not: null } },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapSummary);
}

/** Satu artikel terbit untuk /blog/[slug]; draft dan slug tak dikenal → null. */
export async function getBlogPostBySlug(slug: string): Promise<BlogPostDetail | null> {
  "use cache";
  cacheTag("blog");
  const row = await db.blogPost.findUnique({ where: { slug } });
  if (!row || row.status !== "published" || !row.publishedAt) return null;
  return mapDetail(row);
}

/**
 * Data mentah untuk panel admin — sengaja tanpa cache supaya daftar di panel
 * selalu memperlihatkan tulisan yang baru disimpan. `excerpt` di sini yang
 * tersimpan apa adanya (bukan fallback turunan), supaya form sunting tidak
 * diam-diam menuliskan ringkasan hasil hitungan ke dalam isian admin.
 */
export async function getBlogPostsForAdmin(): Promise<BlogPostAdminRow[]> {
  const rows = await db.blogPost.findMany({
    orderBy: [{ updatedAt: "desc" }],
  });
  return rows.map((row) => ({
    ...mapDetail(row),
    excerpt: row.excerpt,
    status: row.status === "published" ? "published" : "draft",
    authorEmail: row.authorEmail,
    createdAt: row.createdAt.toISOString(),
  }));
}
