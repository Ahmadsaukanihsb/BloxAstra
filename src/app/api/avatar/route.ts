import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

/**
 * Serve the signed-in user's avatar as raw bytes.
 *
 * The avatar is stored as a data URL (up to 500KB). Inlining it into every RSC
 * payload — the top nav renders on every page — would bloat each response and
 * re-send the same bytes on every navigation, so the nav instead points an
 * <img> at this route and the browser caches the result. `?v=` is the row's
 * mtime, so a new upload busts the cache without disabling it.
 *
 * Self-only on purpose: there is no user id in the path, so one account can
 * never enumerate or fetch another's photo.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });

  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { avatarImage: true, updatedAt: true },
  });
  if (!row?.avatarImage) return new NextResponse(null, { status: 404 });

  const match = /^data:(image\/[a-z+.-]+);base64,(.+)$/i.exec(row.avatarImage);
  if (!match) return new NextResponse(null, { status: 404 });

  const [, mime, base64] = match;
  const bytes = Buffer.from(base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": mime,
      // Private: this is per-user, so a shared cache must not store it.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Last-Modified": row.updatedAt.toUTCString(),
    },
  });
}