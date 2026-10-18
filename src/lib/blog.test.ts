import { describe, expect, it } from "vitest";
import {
  blogPostPath,
  deriveBlogExcerpt,
  isValidBlogSlug,
  parseBlogTags,
  renderBlogMarkdown,
  serializeBlogTags,
  slugifyBlogTitle,
} from "@/lib/blog";

/**
 * Blog content goes through two trust boundaries: admin free text becomes a
 * URL slug, and markdown becomes innerHTML. These tests pin both — slugs stay
 * addressable, and the renderer never lets article text escape into markup.
 */

describe("slugifyBlogTitle", () => {
  it("builds readable slugs from Indonesian titles", () => {
    expect(slugifyBlogTitle("Cara Aman Beli Robux di 2026")).toBe("cara-aman-beli-robux-di-2026");
    expect(slugifyBlogTitle("Gamepass vs Robux: mana yang lebih murah?")).toBe(
      "gamepass-vs-robux-mana-yang-lebih-murah",
    );
  });

  it("strips accents, punctuation, and emoji", () => {
    expect(slugifyBlogTitle("Panduan Prémiùm Roblox 🎮 — edisi spesial!")).toBe(
      "panduan-premium-roblox-edisi-spesial",
    );
  });

  it("never returns leading or trailing dashes", () => {
    expect(slugifyBlogTitle("  --Halo--  ")).toBe("halo");
    expect(slugifyBlogTitle("!!!")).toBe("");
  });

  it("caps length without a dangling dash", () => {
    const slug = slugifyBlogTitle("kata ".repeat(40));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidBlogSlug", () => {
  it("accepts lowercase dashed slugs", () => {
    for (const value of ["a", "cara-beli-robux", "tips-2026"]) {
      expect(isValidBlogSlug(value)).toBe(true);
    }
  });

  it("rejects everything that would not survive as a URL segment", () => {
    for (const value of ["", "Cara-Beli", "spasi di sini", "double--dash", "-awal", "akhir-", "a".repeat(81)]) {
      expect(isValidBlogSlug(value)).toBe(false);
    }
  });
});

describe("parseBlogTags", () => {
  it("splits, trims, and dedupes case-insensitively", () => {
    expect(parseBlogTags("Robux, tips , robux, keamanan")).toEqual(["Robux", "tips", "keamanan"]);
  });

  it("caps count and per-tag length", () => {
    const tags = parseBlogTags("1,2,3,4,5,6,7,8");
    expect(tags).toHaveLength(6);
    const [long] = parseBlogTags("x".repeat(100));
    expect(long).toHaveLength(28);
  });

  it("round-trips through serializeBlogTags", () => {
    expect(parseBlogTags(serializeBlogTags(["robux", "tips"]))).toEqual(["robux", "tips"]);
  });
});

describe("deriveBlogExcerpt", () => {
  it("cleans markdown syntax out of the fallback description", () => {
    const excerpt = deriveBlogExcerpt("## Judul\n\n**Beli** [Robux](/katalog) dengan aman.");
    expect(excerpt).toBe("Judul Beli Robux dengan aman.");
  });

  it("truncates with an ellipsis", () => {
    const excerpt = deriveBlogExcerpt("kata ".repeat(60));
    expect(excerpt.length).toBeLessThanOrEqual(160);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});

describe("renderBlogMarkdown", () => {
  it("wraps paragraphs and converts single newlines to breaks", () => {
    expect(renderBlogMarkdown("baris satu\nbaris dua\n\nparagraf baru")).toBe(
      "<p>baris satu<br/>baris dua</p>\n<p>paragraf baru</p>",
    );
  });

  it("renders headings, lists, quotes, and rules", () => {
    expect(renderBlogMarkdown("# Satu")).toBe("<h1>Satu</h1>");
    expect(renderBlogMarkdown("#### Empat")).toBe("<h4>Empat</h4>");
    expect(renderBlogMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
    expect(renderBlogMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
    expect(renderBlogMarkdown("> kutipan")).toBe("<blockquote>kutipan</blockquote>");
    expect(renderBlogMarkdown("---")).toBe("<hr/>");
  });

  it("renders inline code, bold, italic, and links", () => {
    expect(renderBlogMarkdown("pakai `npm test` dulu")).toBe("<p>pakai <code>npm test</code> dulu</p>");
    expect(renderBlogMarkdown("**tebal** dan *miring*")).toBe("<p><strong>tebal</strong> dan <em>miring</em></p>");
    expect(renderBlogMarkdown("[Katalog](/katalog)")).toBe('<p><a href="/katalog">Katalog</a></p>');
  });

  it("opens external links in a new tab but keeps internal links in place", () => {
    expect(renderBlogMarkdown("[luar](https://example.com)")).toBe(
      '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">luar</a></p>',
    );
  });

  it("refuses dangerous link targets instead of linking them", () => {
    const html = renderBlogMarkdown("[klik](javascript:alert(1))");
    expect(html).not.toContain("href");
    expect(html).toContain("javascript:alert(1)");
  });

  it("keeps code fences literal — markdown inside them is not interpreted", () => {
    const html = renderBlogMarkdown("```\n**bukan tebal** <b>tag</b>\n```");
    expect(html).toBe("<pre><code>**bukan tebal** &lt;b&gt;tag&lt;/b&gt;</code></pre>");
  });

  it("escapes raw HTML instead of executing it", () => {
    const html = renderBlogMarkdown('<script>alert("x")</script>\n\n<img src=x onerror=alert(1)>');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("does not let emphasis span across block boundaries", () => {
    expect(renderBlogMarkdown("**mulai\n\nselesai**")).toBe("<p>**mulai</p>\n<p>selesai**</p>");
  });
});

describe("blogPostPath", () => {
  it("builds the public path", () => {
    expect(blogPostPath("tips-aman")).toBe("/blog/tips-aman");
  });
});
