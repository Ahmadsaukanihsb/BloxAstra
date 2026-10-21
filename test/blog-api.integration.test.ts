import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { clearThrottle } from "@/lib/throttle";
import { createTestDatabase, type TestDatabase } from "./test-db";
import { cacheCalls, resetCacheCalls } from "./next-cache-mock";

// Next refuses `updateTag` outside a Server Action; this mock reproduces that
// rule so a regression fails here rather than in production (it did once).
vi.mock("next/cache", async () => await import("./next-cache-mock"));

type BlogRoute = typeof import("@/app/api/blog/posts/route");

interface PostResponse {
  ok: boolean;
  id?: string;
  slug?: string;
  created?: boolean;
  url?: string;
  error?: string;
}

interface ListResponse {
  ok: boolean;
  count: number;
  posts: Array<{ id: string; slug: string; tags: string[]; status: string }>;
}

const TOKEN = "integration-token";

let database: TestDatabase;
let db: PrismaClient;
let POST: BlogRoute["POST"];
let GET: BlogRoute["GET"];

function request(
  body: unknown,
  options: { token?: string | null; method?: "POST" | "GET"; query?: string } = {},
) {
  const headers = new Headers();
  if (options.token !== null) headers.set("authorization", `Bearer ${options.token ?? TOKEN}`);
  if (options.method === "POST" || options.method === undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(new URL(`http://localhost/api/blog/posts${options.query ?? ""}`), {
    method: options.method ?? "POST",
    headers,
    ...(options.method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}

// The endpoint throttles one request per 2s per IP; tests issue requests back
// to back. Clearing the key models an agent retrying after the documented
// window without making the suite sleep (and without weakening the check).
function clearBlogThrottle() {
  clearThrottle("blog-api:unknown");
}

async function createPost(payload: Record<string, unknown>) {
  clearBlogThrottle();
  const response = await POST(request(payload));
  return { response, body: (await response.json()) as PostResponse };
}

async function list(query = "") {
  clearBlogThrottle();
  return GET(
    new NextRequest(new URL(`http://localhost/api/blog/posts${query}`), {
      headers: { authorization: `Bearer ${TOKEN}` },
    }),
  );
}

beforeAll(async () => {
  database = createTestDatabase();
  ({ db } = await import("@/lib/db"));
  ({ POST, GET } = await import("@/app/api/blog/posts/route"));
  process.env.BLOG_API_TOKEN = TOKEN;
});

beforeEach(async () => {
  await db.blogPost.deleteMany();
  await db.adminAuditLog.deleteMany();
  resetCacheCalls();
});

afterAll(async () => {
  await db.$disconnect();
  delete process.env.BLOG_API_TOKEN;
  database.cleanup();
});

describe("POST /api/blog/posts", () => {
  it("rejects a request without the bearer token before touching the DB", async () => {
    clearBlogThrottle();
    const response = await POST(request({ title: "X", content: "Y" }, { token: null }));
    expect(response.status).toBe(401);
    expect(await db.blogPost.count()).toBe(0);
  });

  it("creates and publishes an article, leaving an audit row", async () => {
    const { response, body } = await createPost({
      slug: "panduan-robux",
      title: "Panduan Robux",
      content: "## Pendahuluan\n\nBeli Robux dengan aman.",
      tags: ["robux", "panduan"],
    });

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ ok: true, created: true, slug: "panduan-robux" });

    const row = await db.blogPost.findUnique({ where: { slug: "panduan-robux" } });
    expect(row?.status).toBe("published");
    expect(row?.publishedAt).toBeInstanceOf(Date);
    expect(row?.tags).toBe("robux, panduan");
    expect(row?.authorEmail).toBe("Ahmad Syaukani");

    const audit = await db.adminAuditLog.findFirst({ where: { targetId: row!.id } });
    expect(audit).toMatchObject({ actionType: "blog_post.create", targetResource: "blog" });
  });

  it("updates on a retry with the same slug instead of duplicating or 409ing", async () => {
    const first = await createPost({
      slug: "idempoten",
      title: "Idempoten",
      content: "Isi pertama.",
      tags: ["satu"],
    });
    expect(first.response.status).toBe(201);
    const firstRow = await db.blogPost.findUnique({ where: { slug: "idempoten" } });

    const second = await createPost({
      slug: "idempoten",
      title: "Idempoten",
      content: "Isi kedua setelah edit.",
      tags: ["satu", "dua"],
    });

    expect(second.response.status).toBe(200);
    expect(second.body).toMatchObject({ ok: true, created: false, id: firstRow!.id });

    expect(await db.blogPost.count({ where: { slug: "idempoten" } })).toBe(1);
    const updated = await db.blogPost.findUnique({ where: { slug: "idempoten" } });
    expect(updated?.content).toContain("Isi kedua");
    expect(updated?.tags).toBe("satu, dua");
    // The first publish date is stamped once — an edit must not bump the article
    // back to the top of /blog.
    expect(updated?.publishedAt?.toISOString()).toBe(firstRow?.publishedAt?.toISOString());
    expect(
      await db.adminAuditLog.count({ where: { actionType: "blog_post.update", targetId: firstRow!.id } }),
    ).toBe(1);
  });

  it("never uses updateTag from the route handler (the bug that returned 500 after commit)", async () => {
    const { response } = await createPost({ title: "Cek Cache", content: "Isi." });

    expect(response.status).toBe(201);
    // The mock throws if the route calls it; the assertion below also proves the
    // cache was invalidated through the API that IS legal here.
    expect(cacheCalls.updateTag).toEqual([]);
    expect(cacheCalls.revalidateTag).toContainEqual({ tag: "blog", profile: { expire: 0 } });
  });

  it("derives the slug from the title when none is sent", async () => {
    const { response, body } = await createPost({
      title: "Cara Beli Robux Aman",
      content: "Isi artikel.",
    });

    expect(response.status).toBe(201);
    expect(body.slug).toBe("cara-beli-robux-aman");
    expect(await db.blogPost.count()).toBe(1);
  });

  it("refuses to publish an article with no content", async () => {
    const { response, body } = await createPost({ title: "Kosong", content: "   " });

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(await db.blogPost.count()).toBe(0);
  });

  it("keeps drafts out of the published feed", async () => {
    await createPost({ slug: "draf", title: "Draf", content: "Belum siap.", status: "draft" });
    await createPost({ slug: "terbit", title: "Terbit", content: "Siap." });

    const published = await list("?status=published");
    const body = (await published.json()) as ListResponse;
    expect(body.posts.map((post) => post.slug)).toEqual(["terbit"]);

    const drafts = await list("?status=draft");
    expect(((await drafts.json()) as ListResponse).posts.map((post) => post.slug)).toEqual(["draf"]);
  });

  it("lists tags as an array, not the raw comma string", async () => {
    await createPost({ slug: "tag", title: "Tag", content: "Isi.", tags: ["robux", "tips"] });

    const response = await list("?q=tag");
    const body = (await response.json()) as ListResponse;

    expect(response.status).toBe(200);
    expect(body.count).toBe(1);
    expect(body.posts[0].tags).toEqual(["robux", "tips"]);
  });
});
