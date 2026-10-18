import { describe, expect, it } from "vitest";
import {
  ADMIN_PAGE_SIZE,
  cleanQuery,
  parseKind,
  parseKycScope,
  parseOrderScope,
  parseSearchPage,
  pager,
  rangeLabel,
  searchHref,
} from "@/lib/admin-search";

describe("cleanQuery", () => {
  it("takes the first value when a param is repeated", () => {
    expect(cleanQuery(["vault", "nusantara"])).toBe("vault");
  });

  it("collapses whitespace and caps the length", () => {
    expect(cleanQuery("  bx-  9f0c18  ")).toBe("bx- 9f0c18");
    expect(cleanQuery("a".repeat(200))).toHaveLength(60);
  });

  it("treats a missing param as no query", () => {
    expect(cleanQuery(undefined)).toBe("");
  });
});

describe("param parsing", () => {
  it("falls back to the widest scope for junk values", () => {
    expect(parseKind("../../etc/passwd")).toBe("semua");
    expect(parseOrderScope("DROP TABLE")).toBe("semua");
    expect(parseKycScope(undefined)).toBe("semua");
  });

  it("keeps values it knows", () => {
    expect(parseKind("pengguna")).toBe("pengguna");
    expect(parseOrderScope("sengketa")).toBe("sengketa");
    expect(parseKycScope("pending")).toBe("pending");
  });

  it("only accepts positive integers as a page", () => {
    expect(parseSearchPage("3")).toBe(3);
    expect(parseSearchPage("0")).toBe(1);
    expect(parseSearchPage("-2")).toBe(1);
    expect(parseSearchPage("2.5")).toBe(1);
    expect(parseSearchPage("abc")).toBe(1);
  });
});

describe("pager", () => {
  it("reports no rows without inventing a range", () => {
    const empty = pager(0, 1, ADMIN_PAGE_SIZE);
    expect(empty).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0, total: 0 });
    expect(rangeLabel(empty)).toBe("Tidak ada baris");
  });

  it("counts a partial page and its real total", () => {
    const first = pager(137, 1, ADMIN_PAGE_SIZE);
    expect(first).toMatchObject({ page: 1, pageCount: 7, from: 1, to: 20, offset: 0 });
    expect(first.hasNext).toBe(true);
    expect(first.hasPrev).toBe(false);
    expect(rangeLabel(first)).toBe("Menampilkan 1–20 dari 137");
  });

  it("lands exactly on a full final page", () => {
    const last = pager(40, 2, ADMIN_PAGE_SIZE);
    expect(last).toMatchObject({ page: 2, pageCount: 2, from: 21, to: 40, offset: 20 });
    expect(last.hasNext).toBe(false);
    expect(rangeLabel(last)).toBe("Menampilkan 21–40 dari 40");
  });

  it("clamps a page past the end instead of showing an empty list", () => {
    const beyond = pager(25, 99, ADMIN_PAGE_SIZE);
    expect(beyond).toMatchObject({ page: 2, from: 21, to: 25, offset: 20 });
    expect(beyond.hasNext).toBe(false);
  });

  it("never returns a zero or negative offset", () => {
    for (const page of [0, -5, Number.NaN]) {
      expect(pager(50, page, ADMIN_PAGE_SIZE).offset).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("searchHref", () => {
  it("keeps a plain search plain", () => {
    expect(searchHref({ q: "vault" })).toBe("/admin/cari?q=vault");
    expect(searchHref({})).toBe("/admin/cari");
    expect(searchHref({ kind: "semua", orderScope: "semua", page: 1 })).toBe("/admin/cari");
  });

  it("carries the query and the filters onto page 2", () => {
    const href = searchHref({
      q: "vault",
      kind: "pesanan",
      orderScope: "escrow",
      page: 2,
    });
    const url = new URL(href, "https://example.test");
    expect(url.pathname).toBe("/admin/cari");
    expect(url.searchParams.get("q")).toBe("vault");
    expect(url.searchParams.get("jenis")).toBe("pesanan");
    expect(url.searchParams.get("status")).toBe("escrow");
    expect(url.searchParams.get("hal")).toBe("2");
  });

  it("writes back every filter it was given, so a chip never drops another one", () => {
    const url = new URL(
      searchHref({
        q: "slr",
        kind: "pengguna",
        userScope: "penjual",
        kycScope: "pending",
        page: 3,
      }),
      "https://example.test",
    );
    expect([...url.searchParams.keys()].sort()).toEqual(["hal", "jenis", "kyc", "peran", "q"]);
    expect(url.searchParams.get("kyc")).toBe("pending");
    expect(url.searchParams.get("peran")).toBe("penjual");
  });
});
