import { describe, expect, it } from "vitest";
import { isValidNoticeHref, normalizeNoticeHref } from "@/lib/site-notice-slots";
import { parseSitePopup, parseSitePromo } from "@/lib/site-notice";

/**
 * Both notices flow from admin input into rendered output (text, an `href`,
 * an `src`), and both can be edited by hand in the database. These tests pin
 * the two things that must never depend on trusting that input: links stay
 * internal-or-https, and images stay real images.
 */

describe("normalizeNoticeHref", () => {
  const FALLBACK = "/daftar";

  it("keeps internal paths", () => {
    expect(normalizeNoticeHref("/katalog", FALLBACK)).toBe("/katalog");
    expect(normalizeNoticeHref("  /produk/robux  ", FALLBACK)).toBe("/produk/robux");
  });

  it("keeps absolute https urls", () => {
    expect(normalizeNoticeHref("https://bloxastra.com/katalog", FALLBACK)).toBe(
      "https://bloxastra.com/katalog",
    );
  });

  it("rejects every dangerous shape", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,<script>",
      "//evil.example.com",
      "http://plain.example.com",
      " /spasi di dalam",
      "",
      42,
      null,
    ]) {
      expect(normalizeNoticeHref(value, FALLBACK)).toBe(FALLBACK);
      expect(isValidNoticeHref(value)).toBe(false);
    }
  });
});

describe("parseSitePromo", () => {
  it("falls back to the shipped copy for an empty row", () => {
    const promo = parseSitePromo(null);
    expect(promo.enabled).toBe(true);
    expect(promo.message).toContain("Bonus seller baru");
    expect(promo.ctaHref).toBe("/daftar");
  });

  it("reads an admin payload, clamping long text", () => {
    const promo = parseSitePromo(
      JSON.stringify({
        enabled: false,
        message: "x".repeat(500),
        ctaLabel: "Ambil",
        ctaHref: "/katalog",
      }),
    );
    expect(promo.enabled).toBe(false);
    expect(promo.message.length).toBe(180);
    expect(promo.ctaLabel).toBe("Ambil");
    expect(promo.ctaHref).toBe("/katalog");
  });

  it("never leaks a hostile href out of the database", () => {
    const promo = parseSitePromo(
      JSON.stringify({ enabled: true, message: "Halo", ctaLabel: "X", ctaHref: "javascript:alert(1)" }),
    );
    expect(promo.ctaHref).toBe("/daftar");
  });

  it("survives garbage json", () => {
    expect(parseSitePromo("not json").message).toContain("Bonus seller baru");
  });
});

describe("parseSitePopup", () => {
  it("is off by default", () => {
    const popup = parseSitePopup(null);
    expect(popup.enabled).toBe(false);
    expect(popup.image).toBeNull();
    expect(popup.version).toBe("");
  });

  it("keeps a valid version and drops a fake image", () => {
    const popup = parseSitePopup(
      JSON.stringify({
        enabled: true,
        title: "Promo",
        message: "Diskon",
        ctaLabel: "Klaim",
        ctaHref: "/daftar",
        image: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        version: "abc123",
      }),
    );
    expect(popup.version).toBe("abc123");
    expect(popup.image).toBeNull();
  });

  it("accepts a real png data url", () => {
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(64, 7),
    ]);
    const popup = parseSitePopup(
      JSON.stringify({ enabled: true, image: `data:image/png;base64,${png.toString("base64")}` }),
    );
    expect(popup.image).toMatch(/^data:image\/png;base64,/);
  });
});
