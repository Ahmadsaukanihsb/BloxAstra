import "server-only";
import { revalidatePath, revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import { normalizeImageInput } from "@/lib/images";
import {
  BLOG_COVER_MAX_BYTES,
  blogPostLocalPath,
  isValidBlogSlug,
  parseBlogTags,
  serializeBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog-slots";

/**
 * The single writer for blog posts.
 *
 * Both callers — the admin panel (`saveBlogPost`) and the machine API
 * (`/api/blog/posts`, used by the Hermes automation) — go through here, so the
 * rules (slug derivation, slug conflicts, cover validation, "published needs
 * content", the stamp-once `publishedAt`, the audit row, cache invalidation)
 * exist exactly once and cannot drift between the two doors.
 */

export interface BlogWriteInput {
  id?: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage?: string | null;
  /** Comma-separated string or an array — agents usually send an array. */
  tags: string | string[];
  status: "draft" | "published";
}

export type BlogWriteResult =
  | { ok: true; id: string; slug: string; created: boolean; url: string }
  | { ok: false; code: "INVALID" | "CONFLICT" | "NOT_FOUND"; error: string };

/**
 * Public readers are cached with the `blog` tag; drop it everywhere.
 *
 * `revalidateTag`, not `updateTag`: this helper is shared by a Server Action
 * (the admin panel) and a Route Handler (the machine API), and `updateTag`
 * throws outside a Server Action — which made every API write commit its
 * transaction and then answer 500. `{ expire: 0 }` is its documented
 * equivalent for any caller: the next request blocks on fresh data.
 */
export function revalidateBlog(slugs: string[]): void {
  revalidateTag("blog", { expire: 0 });
  revalidatePath("/blog");
  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidatePath(blogPostLocalPath(slug));
  }
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin");
}

function tagsToRaw(tags: string | string[]): string {
  return Array.isArray(tags) ? tags.join(",") : tags;
}

export async function saveBlogPostCore(
  input: BlogWriteInput,
  actor: string,
  options: { ip?: string | null } = {},
): Promise<BlogWriteResult> {
  const slug = slugifyBlogTitle(input.slug.trim() || input.title);
  if (!isValidBlogSlug(slug)) {
    return {
      ok: false,
      code: "INVALID",
      error: "Slug kosong/tidak valid — isi judul atau slug dengan huruf biasa.",
    };
  }
  if (input.status === "published" && !input.content.trim()) {
    return { ok: false, code: "INVALID", error: "Artikel perlu isi sebelum diterbitkan." };
  }

  const cover = input.coverImage ?? null;
  if (cover !== null && cover !== "" && !normalizeImageInput(cover, BLOG_COVER_MAX_BYTES)) {
    return {
      ok: false,
      code: "INVALID",
      error: `Sampul harus PNG/JPEG/GIF/WebP di bawah ${Math.round(BLOG_COVER_MAX_BYTES / 1000)}KB, atau URL https yang valid.`,
    };
  }

  const existing = input.id
    ? await db.blogPost.findUnique({ where: { id: input.id } })
    : null;
  if (input.id && !existing) {
    return { ok: false, code: "NOT_FOUND", error: "Artikel tidak ditemukan." };
  }

  const slugOwner = await db.blogPost.findUnique({ where: { slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== existing?.id) {
    return { ok: false, code: "CONFLICT", error: `Slug "${slug}" sudah dipakai artikel lain.` };
  }

  // Stamped on the first publish and kept afterwards, so editing an old
  // article never moves it back to the top of /blog.
  const publishedAt =
    existing?.publishedAt ?? (input.status === "published" ? new Date() : null);

  const data = {
    slug,
    title: input.title,
    excerpt: input.excerpt.trim(),
    content: input.content,
    coverImage: cover || null,
    tags: serializeBlogTags(parseBlogTags(tagsToRaw(input.tags))),
    status: input.status,
    publishedAt,
    authorEmail: actor ?? null,
  };

  const post = await db.$transaction(async (tx) => {
    const saved = existing
      ? await tx.blogPost.update({ where: { id: existing.id }, data })
      : await tx.blogPost.create({ data });
    await tx.adminAuditLog.create({
      data: {
        actionType: existing ? "blog_post.update" : "blog_post.create",
        targetResource: "blog",
        targetId: saved.id,
        diffPayload: JSON.stringify({
          slug: saved.slug,
          judul: saved.title,
          status: saved.status,
          actor,
        }),
        actor,
        ipAddress: options.ip ?? "unknown",
      },
    });
    return saved;
  });

  // A rename leaves the old URL as a 404; invalidate it too so the cached page
  // disappears immediately instead of after its next revalidation.
  revalidateBlog([post.slug, existing?.slug ?? ""]);
  return { ok: true, id: post.id, slug: post.slug, created: !existing, url: blogPostLocalPath(post.slug) };
}