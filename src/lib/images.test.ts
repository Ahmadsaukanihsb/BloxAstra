import { describe, expect, it } from "vitest";
import { validImageDataUrl } from "@/lib/images";

function dataUrl(mime: string, bytes: number[]): string {
  return `${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0];
const JPG = [0xff, 0xd8, 0xff, 0x00, 0, 0, 0, 0, 0, 0, 0, 0];
const GIF = [0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

describe("validImageDataUrl", () => {
  it("accepts each supported format by magic bytes", () => {
    expect(validImageDataUrl(dataUrl("data:image/png", PNG))).toBe(true);
    expect(validImageDataUrl(dataUrl("data:image/jpeg", JPG))).toBe(true);
    expect(validImageDataUrl(dataUrl("data:image/gif", GIF))).toBe(true);
    expect(validImageDataUrl(dataUrl("data:image/webp", WEBP))).toBe(true);
  });

  it("rejects prefix/bytes mismatches (spoofed MIME)", () => {
    expect(validImageDataUrl(dataUrl("data:image/png", JPG))).toBe(false);
    expect(validImageDataUrl(dataUrl("data:image/jpeg", PNG))).toBe(false);
  });

  it("rejects unknown prefixes, garbage and non-strings", () => {
    expect(validImageDataUrl(dataUrl("data:image/bmp", PNG))).toBe(false);
    expect(validImageDataUrl("data:image/png;base64,!!!not-base64!!!")).toBe(false);
    expect(validImageDataUrl("https://example.com/a.png")).toBe(false);
    expect(validImageDataUrl("")).toBe(false);
    expect(validImageDataUrl(null)).toBe(false);
    expect(validImageDataUrl(42)).toBe(false);
  });

  it("enforces the byte cap", () => {
    const big = Buffer.alloc(100, 0);
    PNG.forEach((byte, index) => {
      big[index] = byte;
    });
    const url = `data:image/png;base64,${big.toString("base64")}`;
    expect(validImageDataUrl(url, 50)).toBe(false);
    expect(validImageDataUrl(url, 200)).toBe(true);
  });
});
