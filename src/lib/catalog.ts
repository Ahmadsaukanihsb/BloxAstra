import { cacheTag } from "next/cache";
import type {
  Category as CategoryRow,
  Product as ProductRow,
  SellerProfile as SellerRow,
} from "@prisma/client";
import { db } from "@/lib/db";
import type {
  Category,
  CategorySlug,
  DeliveryKind,
  Product,
  Seller,
  SellerTier,
} from "@/lib/types";

/**
 * Server-side catalog data layer. Every reader is a `use cache` function tagged
 * with "catalog" so admin mutations (Phase 5) only need `revalidateTag("catalog")`
 * to refresh every katalog, landing, and product surface at once.

 */

/** UI ordering for the mega menu & filter chips — the DB has no sort column. */
const CATEGORY_ORDER: CategorySlug[] = ["gamepass", "item", "gift", "akun", "premium"];

function mapCategory(row: CategoryRow): Category {
  return {
    slug: row.slug as CategorySlug,
    name: row.name,
    tagline: row.tagline,
    fulfillment: row.fulfillment,
    slaMinutes: row.slaMinutes,
    taxCoverSupported: row.taxCoverSupported,
    autoDelivery: row.autoDelivery,
    commissionPercent: row.commissionPercent,
  };
}

function mapSeller(row: SellerRow): Seller {
  return {
    id: row.id,
    storeName: row.storeName,
    handle: row.handle,
    tier: row.tier as SellerTier,
    isOnline: row.isOnline,
    hasExpressBadge: row.hasExpressBadge,
    avgDeliverySeconds: row.avgDeliverySeconds,
    rating: row.rating,
    reviewCount: row.reviewCount,
    ordersCompleted: row.ordersCompleted,
    disputeRatePercent: row.disputeRatePercent,
    joinedOn: row.joinedOn.toISOString().slice(0, 10),
    city: row.city,
    kycVerified: row.kycVerified,
    bio: row.bio,
    storeImage: row.storeImage,
  };
}

function parseHighlights(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.categorySlug as CategorySlug,
    game: row.game,
    netRobux: row.netRobux ?? undefined,
    pricingMode:
      row.pricingMode === "no_cover" ? "no_cover" : row.pricingMode === "cover" ? "cover" : undefined,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    stock: row.stock,
    deliveryKind: row.deliveryKind as DeliveryKind,
    sellerId: row.sellerId,
    sold: row.sold,
    description: row.description,
    highlights: parseHighlights(row.highlights),
    autoReleaseHours: row.autoReleaseHours,
    instantDelivery: row.instantDelivery,
    featured: row.featured,
    isListed: row.isListed,
    imageUrl: row.imageUrl ?? undefined,
    sortOrder: row.sortOrder,
    shelf: row.shelf,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheTag("catalog");
  const rows = await db.category.findMany();
  const rank = (slug: string) => {
    const index = CATEGORY_ORDER.indexOf(slug as CategorySlug);
    return index === -1 ? CATEGORY_ORDER.length : index;
  };
  return rows
    .map(mapCategory)
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  "use cache";
  cacheTag("catalog");
  const row = await db.category.findUnique({ where: { slug } });
  return row ? mapCategory(row) : null;
}

export async function getSellers(): Promise<Seller[]> {
  "use cache";
  cacheTag("catalog");
  const rows = await db.sellerProfile.findMany({ orderBy: { handle: "asc" } });
  return rows.map(mapSeller);
}

export async function getSellerMap(): Promise<Record<string, Seller>> {
  "use cache";
  cacheTag("catalog");
  const sellers = await getSellers();
  return Object.fromEntries(sellers.map((seller) => [seller.id, seller]));
}

export async function getProducts(): Promise<Product[]> {
  "use cache";
  cacheTag("catalog");
  const rows = await db.product.findMany({
    where: { isListed: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return rows.map(mapProduct);
}

/** Products flagged `featured` for the home-page shelf, in curation order. */
export async function getFeaturedProducts(): Promise<Product[]> {
  "use cache";
  cacheTag("catalog");
  const rows = await db.product.findMany({
    where: { featured: true, isListed: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return rows.map(mapProduct);
}

/** Products assigned to a named landing shelf ("pack" | "limited" | "service"). */
export async function getShelfProducts(shelf: string): Promise<Product[]> {
  "use cache";
  cacheTag("catalog");
  const rows = await db.product.findMany({
    where: { shelf, isListed: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return rows.map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  "use cache";
  cacheTag("catalog");
  const row = await db.product.findUnique({ where: { slug } });
  if (!row || !row.isListed) return null;
  return mapProduct(row);
}

/** Products by id (wishlist, rails) — listed-only, order preserved. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: ids.slice(0, 24) }, isListed: true },
  });
  const byId = new Map(rows.map((row) => [row.id, mapProduct(row)]));
  return ids.map((id) => byId.get(id)).filter((item): item is Product => Boolean(item));
}

/** One-shot product + seller + category bundle for the detail page. */
export async function getProductDetail(
  slug: string,
): Promise<{ product: Product; seller: Seller; category: Category } | null> {
  "use cache";
  cacheTag("catalog");
  const row = await db.product.findUnique({
    where: { slug },
    include: { seller: true, category: true },
  });
  if (!row || !row.isListed) return null;
  return {
    product: mapProduct(row),
    seller: mapSeller(row.seller),
    category: mapCategory(row.category),
  };
}
