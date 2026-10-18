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

/**
 * External image URL an admin may paste for a product photo.
 *
 * Deliberately strict: product images render as <img src> on public pages, so
 * an unchecked value is an injection and tracking surface. Rules:
 *   - https only. `http:` would mix content; `javascript:`/`data:text/html`
 *     are script vectors; `data:image/*` is already covered by the data-URL path.
 *   - rejects localhost / private / link-local hosts, so a pasted URL can never
 *     turn the browser into an SSRF probe of our own network.
 *   - no credentials in the URL (user:pass@) — those leak into referrers/logs.
 * Returns the normalized URL, or null when it is not acceptable.
 */
export function normalizeExternalImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > 2000) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();
  // Bare IP or loopback/private name — never let a pasted URL point inward.
  const isPrivateV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host) &&
    (host.startsWith("10.") ||
      host.startsWith("127.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host));
  const isLocalName =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local");
  if (isPrivateV4 || isLocalName) return null;

  return url.toString();
}

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

/**
 * An image value that is either an uploaded data URL or a pasted https URL —
 * the two shapes the admin panels accept. Returns the normalized value to store,
 * or null when it is neither.
 *
 * The size cap applies to data URLs only; a remote URL costs us no payload
 * bytes, so it is validated purely for shape (see `normalizeExternalImageUrl`).
 */
export function normalizeImageInput(value: unknown, maxBytes = 1_500_000): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw.length === 0) return null;
  if (raw.startsWith("data:")) return validImageDataUrl(raw, maxBytes) ? raw : null;
  return normalizeExternalImageUrl(raw);
}
