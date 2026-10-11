import "server-only";
import { db } from "@/lib/db";

/** Product ids the user saved, newest first. Empty for guests. */
export async function getWishlistIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await db.wishlistItem.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { productId: true },
    take: 200,
  });
  return rows.map((row) => row.productId);
}