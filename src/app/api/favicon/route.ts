import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSiteFavicon, faviconMimeType } from "@/lib/site-favicon";

/**
 * Serves the browser-tab icon at one stable URL, so the icon can be swapped
 * from the admin panel without a deploy: the route reads the stored data URL at
 * request time.
 *
 * Fallback is the brand `.ico` that lives in `public/` (the file that used to be
 * `app/favicon.ico`). That file had to move out of `app/`: the file-based
 * metadata convention outranks `metadata.icons`, so as long as it sat there it
 * would have silently kept overriding any custom favicon the admin set.
 */

/** Read once at module scope — the fallback never changes at runtime. */
let fallbackPromise: Promise<Buffer> | null = null;

function fallbackIcon(): Promise<Buffer> {
  fallbackPromise ??= readFile(path.join(process.cwd(), "public", "favicon.ico"));
  return fallbackPromise;
}

export async function GET() {
  const cacheControl = "public, max-age=300, stale-while-revalidate=86400";
  const custom = await getSiteFavicon();

  if (custom) {
    const comma = custom.indexOf(",");
    if (comma !== -1) {
      const bytes = Buffer.from(custom.slice(comma + 1), "base64");
      return new NextResponse(new Uint8Array(bytes), {
        status: 200,
        headers: { "Content-Type": faviconMimeType(custom), "Cache-Control": cacheControl },
      });
    }
  }

  try {
    const ico = await fallbackIcon();
    return new NextResponse(new Uint8Array(ico), {
      status: 200,
      headers: { "Content-Type": "image/x-icon", "Cache-Control": cacheControl },
    });
  } catch {
    // No static icon on disk — a 404 here makes the browser show a blank
    // document glyph, so answer 204 and let it fall back on its own.
    return new NextResponse(null, { status: 204 });
  }
}
