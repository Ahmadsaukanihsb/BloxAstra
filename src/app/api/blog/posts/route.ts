import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  BLOG_CONTENT_MAX,
  BLOG_EXCERPT_MAX,
  BLOG_SLUG_MAX,
  BLOG_TAG_COUNT_MAX,
  BLOG_TAG_MAX,
  BLOG_TITLE_MAX,
  blogPostLocalPath,
  deriveBlogExcerpt,
  parseBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog";
import { authorizeBlogApi } from "@/lib/blog-api";
import { saveBlogPostCore } from "@/lib/blog-write";

/**
 * Machine-facing blog endpoint (the Hermes automation).
 *
 *   POST /api/blog/posts  create or update ONE article, keyed on `slug`, so a
 *                         retry updates instead of duplicating.
 *   GET  /api/blog/posts  list articles + status, so the agent can see what it
 *                         already wrote before writing again.
 *
 * Auth is `Authorization: Bearer $BLOG_API_TOKEN` (see lib/blog-api.ts). The
 * write path is the same `saveBlogPostCore` the admin panel uses, so validators
 * cannot drift; every write lands in AdminAuditLog as "Ahmad Syaukani".
 */

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

const postSchema = z.object({
  slug: z.string().trim().max(BLOG_SLUG_MAX * 2).optional(),
  title: z.string().trim().min(1).max(BLOG_TITLE_MAX),
  content: z.string().max(BLOG_CONTENT_MAX),
  excerpt: z.string().max(BLOG_EXCERPT_MAX).optional(),
  // Agents usually send an array; the admin panel sends a comma string.
  tags: z
    .union([
      z.string().max(400),
      z.array(z.string().trim().min(1).max(BLOG_TAG_MAX)).max(BLOG_TAG_COUNT_MAX),
    ])
    .optional(),
  // An https URL is the normal case for an agent; a data URL also passes.
  coverImage: z.string().max(1_200_000).nullable().optional(),
  status: z.enum(["draft", "published"]).optional(),
});

export async function POST(request: NextRequest) {
  const auth = authorizeBlogApi(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Body bukan JSON." }, 400);
  }

  const parsed = postSchema.safeParse(payload);
  if (!parsed.success) {
    return json(
      { ok: false, error: "Input tidak valid.", issues: parsed.error.issues.map((i) => i.message) },
      400,
    );
  }

  const input = parsed.data;

  // Idempotent by design: the agent retries after a timeout, and a retry must
  // UPDATE the article it already wrote rather than 409 on its own slug.
  // `saveBlogPostCore` only updates when it is given an id, so resolve the id
  // from the same slug the writer would derive before calling it.
  const effectiveSlug = slugifyBlogTitle(input.slug?.trim() || input.title);
  const existing = effectiveSlug
    ? await db.blogPost.findUnique({ where: { slug: effectiveSlug }, select: { id: true } })
    : null;

  const result = await saveBlogPostCore(
    {
      id: existing?.id ?? null,
      title: input.title,
      slug: input.slug ?? "",
      excerpt: input.excerpt?.trim() || deriveBlogExcerpt(input.content),
      content: input.content,
      coverImage: input.coverImage ?? null,
      tags: input.tags ?? "",
      // Automation publishes by default — the operator asked for that.
      status: input.status ?? "published",
    },
    auth.actor,
    { ip: auth.ip },
  );

  if (!result.ok) {
    const status = result.code === "CONFLICT" ? 409 : result.code === "NOT_FOUND" ? 404 : 400;
    return json({ ok: false, code: result.code, error: result.error }, status);
  }

  return json(
    {
      ok: true,
      id: result.id,
      slug: result.slug,
      url: result.url,
      created: result.created,
      author: auth.actor,
    },
    result.created ? 201 : 200,
  );
}

export async function GET(request: NextRequest) {
  const auth = authorizeBlogApi(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const params = request.nextUrl.searchParams;
  const statusParam = params.get("status");
  const status = statusParam === "draft" || statusParam === "published" ? statusParam : null;
  const limitRaw = Number(params.get("limit"));
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200) : 50;
  const q = params.get("q")?.trim();

  const rows = await db.blogPost.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { slug: { contains: q } }] } : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      tags: true,
      status: true,
      publishedAt: true,
      authorEmail: true,
      updatedAt: true,
    },
  });

  return json({
    ok: true,
    count: rows.length,
    posts: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      url: blogPostLocalPath(row.slug),
      title: row.title,
      excerpt: row.excerpt,
      // Stored as ", "-joined; use the same parser as the public pages so the
      // JSON never exposes leading spaces (" tips") that the site never shows.
      tags: parseBlogTags(row.tags ?? ""),
      status: row.status,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      author: row.authorEmail,
      updatedAt: row.updatedAt.toISOString(),
    })),
  });
}