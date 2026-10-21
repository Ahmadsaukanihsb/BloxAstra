import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authorizeBlogApi } from "@/lib/blog-api";

/**
 * Topic material for the blog automation.
 *
 * The agent's hard problem is not writing — it is not repeating itself. This
 * hands back what the catalogue actually sells (categories + the games present)
 * plus every headline and tag already published, so a new article can be aimed
 * at a gap instead of a guess. Read-only.
 */

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  const auth = authorizeBlogApi(request);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status);

  const [categories, gameRows, posts] = await Promise.all([
    db.category.findMany({
      orderBy: { name: "asc" },
      select: { slug: true, name: true, tagline: true, fulfillment: true, slaMinutes: true },
    }),
    db.product.groupBy({
      by: ["game"],
      where: { isListed: true },
      _count: { _all: true },
      orderBy: { _count: { game: "desc" } },
      take: 40,
    }),
    db.blogPost.findMany({
      orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
      select: { slug: true, title: true, tags: true, status: true, publishedAt: true },
    }),
  ]);

  const published = posts.filter((post) => post.status === "published");
  const usedTags = new Set<string>();
  for (const post of posts) {
    for (const tag of post.tags.split(",")) {
      const clean = tag.trim();
      if (clean) usedTags.add(clean);
    }
  }

  return json({
    ok: true,
    catalogue: {
      categories: categories.map((category) => ({
        slug: category.slug,
        name: category.name,
        tagline: category.tagline,
        fulfillment: category.fulfillment,
        slaMinutes: category.slaMinutes,
      })),
      games: gameRows.map((row) => ({ game: row.game, listedProducts: row._count._all })),
    },
    blog: {
      total: posts.length,
      published: published.length,
      drafts: posts.length - published.length,
      // Titles/slugs are the "already covered" list the agent must avoid.
      titles: posts.map((post) => post.title),
      slugs: posts.map((post) => post.slug),
      tagsUsed: [...usedTags].sort(),
    },
  });
}