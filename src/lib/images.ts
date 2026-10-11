/**
 * Data-URL image validation shared by dispute evidence and KYC documents.
 * PNG/JPEG/GIF/WebP only, magic bytes verified — client MIME types are
 * spoofable so the prefix must match the actual bytes.
 */
const PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/gif;base64,",
  "data:image/webp;base64,",
] as const;

export function validImageDataUrl(value: unknown, maxBytes = 1_500_000): value is string {
  if (typeof value !== "string") return false;
  const prefix = PREFIXES.find((item) => value.startsWith(item));
  if (!prefix) return false;
  let bytes: Buffer;
  try {
    bytes = Buffer.from(value.slice(prefix.length), "base64");
  } catch {
    return false;
  }
  if (bytes.length < 12 || bytes.length > maxBytes) return false;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  if (prefix.includes("png")) return isPng;
  if (prefix.includes("jpeg")) return isJpg;
  if (prefix.includes("gif")) return isGif;
  return isWebp;
}
