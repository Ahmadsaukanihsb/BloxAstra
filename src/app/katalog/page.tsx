import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { CatalogBrowser } from "@/components/catalog/catalog-browser";
import { Skeleton } from "@/components/ui/feedback";
import { getCurrentUser } from "@/lib/auth";
import { getCategories, getProducts, getSellerMap } from "@/lib/catalog";
import { getWishlistIds } from "@/lib/wishlist";
import type { CategorySlug } from "@/lib/types";

export const metadata: Metadata = {
  title: "Katalog listing Roblox",
  description:
    "Jelajahi listing Robux gamepass, item in-game, Gift Card, akun, dan Roblox Premium dari penjual terverifikasi dengan penahanan dana Blox Astra.",
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseCategory(
  categories: { slug: string }[],
  value: string | string[] | undefined,
): CategorySlug | "semua" {
  const raw = first(value);
  return categories.some((category) => category.slug === raw) ? (raw as CategorySlug) : "semua";
}

function parseGame(games: string[], value: string | string[] | undefined): string {
  const raw = first(value);
  return games.includes(raw) ? raw : "semua";
}

function parsePenjual(handles: string[], value: string | string[] | undefined): string {
  const raw = first(value).trim().toLowerCase();
  return handles.includes(raw) ? raw : "semua";
}

function parsePage(value: string | string[] | undefined): number {
  const raw = Number(first(value));
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

function CatalogFallback() {
  return (
      <div className="shell pb-24 pt-10 md:pt-14">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <Skeleton className="h-11 w-full max-w-2xl rounded-full" />
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-card bg-canvas p-2.5 outline outline-1 -outline-offset-1 outline-line"
            >
              <Skeleton className="aspect-[4/3] w-full rounded-card" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Search-param access lives here so the page shell can still be prerendered. */
async function CatalogContent({
  searchParams,
}: {
  searchParams: PageProps<"/katalog">["searchParams"];
}) {
  // connection() first: getCurrentUser() reads cookies, which blocks
  // prerendering unless this component stays behind the Suspense boundary.
  await connection();
  const [params, categories, products, sellers, user] = await Promise.all([
    searchParams,
    getCategories(),
    getProducts(),
    getSellerMap(),
    getCurrentUser(),
  ]);
  const gameNames = [...new Set(products.map((product) => product.game))];
  const handles = [...new Set(Object.values(sellers).map((seller) => seller.handle))];
  const wishlistIds = await getWishlistIds(user?.id ?? null);
  const initialCategory = parseCategory(categories, params.kategori);
  const initialGame = parseGame(gameNames, params.game);
  const initialQuery = first(params.q).slice(0, 60);
  const initialPenjual = parsePenjual(handles, params.penjual);
  const initialPage = parsePage(params.hal);
  return (
    <CatalogBrowser
      // Remount on navigation (e.g. "Lihat kategori" from another katalog
      // page) so new URL params become state instead of going stale.
      key={`${initialCategory}|${initialGame}|${initialQuery}|${initialPenjual}|${initialPage}`}
      categories={categories}
      products={products}
      sellers={sellers}
      initialCategory={initialCategory}
      initialGame={initialGame}
      initialQuery={initialQuery}
      initialPenjual={initialPenjual}
      initialPage={initialPage}
      wishlistIds={wishlistIds}
    />
  );
}

export default function CatalogPage(props: PageProps<"/katalog">) {
  return (
    <Suspense fallback={<CatalogFallback />}>
      <CatalogContent searchParams={props.searchParams} />
    </Suspense>
  );
}
