"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type WishlistResult =
  | { ok: true; saved: boolean }
  | { ok: false; error: string };

const schema = z.object({ productId: z.string().min(1).max(50) });

/** Toggle save/unsave. Login-gated (logged-out clicks land on /masuk). */
export async function toggleWishlist(rawInput: unknown): Promise<WishlistResult> {
  const user = await requireUser();
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: "Produk tidak valid." };

  const product = await db.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true },
  });
  if (!product) return { ok: false, error: "Listing tidak ditemukan." };

  const existing = await db.wishlistItem.findUnique({
    where: { userId_productId: { userId: user.id, productId: product.id } },
    select: { id: true },
  });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
  } else {
    try {
      await db.wishlistItem.create({ data: { userId: user.id, productId: product.id } });
    } catch (error) {
      // Lost a create/create race with another tab — row exists now.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        return { ok: true, saved: true };
      }
      throw error;
    }
  }

  revalidatePath("/katalog");
  revalidatePath(`/produk/${product.slug}`);
  return { ok: true, saved: !existing };
}
