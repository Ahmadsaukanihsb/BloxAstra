"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatIDR, formatNumber } from "@/lib/format";
import type { Category, CategorySlug, Product, Seller } from "@/lib/types";
import { EXPRESS_SLA_SECONDS } from "@/lib/order-meta";
import { repriceCatalog, type RateCard } from "@/lib/robux-pricing";
import { useRateCard } from "@/components/rates/rate-store";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { ProductCard } from "@/components/product/product-card";
import { SellerAvatar, StarRating } from "@/components/ui/art";
import {
  IconBolt,
  IconCompass,
  IconGrid,
  IconRows,
  IconSearch,
  IconSliders,
  IconX,
} from "@/components/ui/icons";

type SortKey = "terlaris" | "termurah" | "termahal" | "tercepat" | "rating";
type View = "grid" | "row";

interface Filters {
  category: CategorySlug | "semua";
  game: string;
  query: string;
  sort: SortKey;
  onlineOnly: boolean;
  expressOnly: boolean;
  instantOnly: boolean;
  maxPrice: number;
  /** seller handle filter ("semua" = off) — drives ?penjual= for Tanya-penjual links */
  penjual: string;
}

const FALLBACK_FLOOR = 50_000;
const FALLBACK_CAP = 1_500_000;
const PAGE_SIZE = 24;

function makeFilters(priceCap: number, overrides: Partial<Filters> = {}): Filters {
  return {
    category: "semua",
    game: "semua",
    query: "",
    sort: "terlaris",
    onlineOnly: false,
    expressOnly: false,
    instantOnly: false,
    maxPrice: priceCap,
    penjual: "semua",
    ...overrides,
  };
}

/** Slider bounds derived from live repriced prices — never a fixed Rp1,5jt. */
export function priceBoundsOf(products: Product[], rateCard: RateCard): {
  floor: number;
  cap: number;
} {
  const prices = repriceCatalog(products, rateCard).map((product) => product.price);
  if (prices.length === 0) return { floor: FALLBACK_FLOOR, cap: FALLBACK_CAP };
  const floor = Math.max(0, Math.floor(Math.min(...prices) / 50_000) * 50_000);
  const cap = Math.max(floor + 50_000, Math.ceil(Math.max(...prices) / 50_000) * 50_000);
  return { floor, cap };
}

function filterKeyOf(filters: Filters): string {
  return [
    filters.category,
    filters.game,
    filters.query,
    filters.sort,
    filters.onlineOnly,
    filters.expressOnly,
    filters.instantOnly,
    filters.maxPrice,
    filters.penjual,
  ].join("|");
}

function computeResults(
  filters: Filters,
  rateCard: RateCard,
  products: Product[],
  sellers: Record<string, Seller>,
): Product[] {
  const needle = filters.query.trim().toLowerCase();
  const list = repriceCatalog(products, rateCard).filter((product) => {
    const seller = sellers[product.sellerId];
    if (!seller) return false;
    if (filters.category !== "semua" && product.category !== filters.category) return false;
    if (filters.game !== "semua" && product.game !== filters.game) return false;
    if (filters.penjual !== "semua" && seller.handle !== filters.penjual) return false;
    if (filters.onlineOnly && !seller.isOnline) return false;
    if (filters.expressOnly && seller.avgDeliverySeconds > EXPRESS_SLA_SECONDS) return false;
    if (filters.instantOnly && !product.instantDelivery) return false;
    if (product.price > filters.maxPrice) return false;
    if (
      needle &&
      !`${product.title} ${product.game} ${seller.storeName}`.toLowerCase().includes(needle)
    ) {
      return false;
    }
    return true;
  });

  const sorted = [...list];
  sorted.sort((a, b) => {
    switch (filters.sort) {
      case "termurah":
        return a.price - b.price;
      case "termahal":
        return b.price - a.price;
      case "tercepat":
        return (sellers[a.sellerId]?.avgDeliverySeconds ?? 0) - (sellers[b.sellerId]?.avgDeliverySeconds ?? 0);
      case "rating":
        return (sellers[b.sellerId]?.rating ?? 0) - (sellers[a.sellerId]?.rating ?? 0);
      default:
        return b.sold - a.sold;
    }
  });
  return sorted;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "terlaris", label: "Paling laris" },
  { value: "termurah", label: "Harga terendah" },
  { value: "termahal", label: "Harga tertinggi" },
  { value: "tercepat", label: "Serah terima tercepat" },
  { value: "rating", label: "Rating penjual" },
];

/**
 * The initial category arrives as a prop from the server page (which reads
 * searchParams) rather than through useSearchParams — a client-side
 * useSearchParams read would opt the whole grid out of server rendering.
 */
export function CatalogBrowser({
  categories,
  products,
  sellers,
  initialCategory = "semua",
  initialGame = "semua",
  initialQuery = "",
  initialPenjual = "semua",
  initialPage = 1,
  wishlistIds = [],
}: {
  categories: Category[];
  products: Product[];
  sellers: Record<string, Seller>;
  initialCategory?: CategorySlug | "semua";
  initialGame?: string;
  initialQuery?: string;
  initialPenjual?: string;
  initialPage?: number;
  wishlistIds?: string[];
}) {
  const verifiedSellers = Object.values(sellers).filter((seller) => seller.kycVerified).length;
  const rateCard = useRateCard();
  const { floor: priceFloor, cap: priceCap } = useMemo(
    () => priceBoundsOf(products, rateCard),
    [products, rateCard],
  );
  const [category, setCategory] = useState<CategorySlug | "semua">(initialCategory);
  const [game, setGame] = useState<string>(initialGame);
  const [query, setQuery] = useState(initialQuery);
  const [penjual, setPenjual] = useState<string>(initialPenjual);
  const [page, setPage] = useState<number>(
    Number.isInteger(initialPage) && initialPage > 0 ? initialPage : 1,
  );
  const [sort, setSort] = useState<SortKey>("terlaris");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [expressOnly, setExpressOnly] = useState(false);
  const [instantOnly, setInstantOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(priceCap);
  const [view, setView] = useState<View>("grid");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Live prices can shift the cap after mount (rate requote) — derive the
  // effective ceiling during render instead of syncing state in an effect.
  const effectiveMaxPrice = Math.min(maxPrice, priceCap);

  // Fill share for the price slider track. The cap can move after mount, so
  // clamp both ends and guard the zero-width range instead of dividing by it.
  const pricePercent =
    priceCap > priceFloor
      ? ((Math.min(Math.max(effectiveMaxPrice, priceFloor), priceCap) - priceFloor) /
          (priceCap - priceFloor)) *
        100
      : 100;

  const filters: Filters = {
    category,
    game,
    query,
    sort,
    onlineOnly,
    expressOnly,
    instantOnly,
    maxPrice: effectiveMaxPrice,
    penjual,
  };
  const filterKey = filterKeyOf(filters);

  // Results land one beat after the last keystroke so filtering reads as work
  // being done; `pending` is derived, never set inside the effect body.
  const [applied, setApplied] = useState<{ key: string; items: Product[] }>(() => {
    const seeded = makeFilters(priceCap, {
      category: initialCategory,
      game: initialGame,
      query: initialQuery,
      maxPrice: priceCap,
    });
    return { key: filterKeyOf(seeded), items: computeResults(seeded, rateCard, products, sellers) };
  });

  useEffect(() => {
    const snapshot = filterKey;
    const timer = window.setTimeout(() => {
      setApplied({ key: snapshot, items: computeResults(filters, rateCard, products, sellers) });
    }, 260);
    return () => window.clearTimeout(timer);
    // `filters` is fully described by filterKey; rateCard only re-quotes robux.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, rateCard]);

  const pending = applied.key !== filterKey;
  const results = applied.items;
  const wishlistSet = useMemo(() => new Set(wishlistIds), [wishlistIds]);
  const gameNames = useMemo(
    () => [...new Set(products.map((product) => product.game))],
    [products],
  );
  const gameNamesRef = useRef<string[]>([]);
  useEffect(() => {
    gameNamesRef.current = gameNames;
  }, [gameNames]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const visible = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeFrom = results.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(safePage * PAGE_SIZE, results.length);

  // Filters (but not the page) reset pagination — skipped on first mount so a
  // shared ?hal= link lands on the right page.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setPage(1);
  }, [filterKey]);

  // Keep the URL shareable without a server roundtrip. Back/forward restores
  // state via the popstate listener below.
  useEffect(() => {
    const params = new URLSearchParams();
    if (category !== "semua") params.set("kategori", category);
    if (game !== "semua") params.set("game", game);
    if (query.trim()) params.set("q", query.trim().slice(0, 60));
    if (penjual !== "semua") params.set("penjual", penjual);
    if (safePage > 1) params.set("hal", String(safePage));
    const suffix = params.toString();
    window.history.replaceState(null, "", suffix ? `/katalog?${suffix}` : "/katalog");
  }, [category, game, query, penjual, safePage]);

  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search);
      const rawCategory = params.get("kategori") ?? "semua";
      setCategory(
        rawCategory === "semua" || categories.some((item) => item.slug === rawCategory)
          ? (rawCategory as CategorySlug | "semua")
          : "semua",
      );
      const rawGame = params.get("game") ?? "semua";
      setGame(gameNamesRef.current.includes(rawGame) ? rawGame : "semua");
      setQuery(params.get("q") ?? "");
      setPenjual(params.get("penjual") ?? "semua");
      const hal = Number(params.get("hal"));
      setPage(Number.isInteger(hal) && hal > 0 ? hal : 1);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const penjualName =
    penjual === "semua"
      ? null
      : Object.values(sellers).find((seller) => seller.handle === penjual)?.storeName ?? penjual;
  const activeFilters = [
    category !== "semua" ? categories.find((item) => item.slug === category)?.name : null,
    game !== "semua" ? game : null,
    penjualName,
    onlineOnly ? "Penjual online" : null,
    expressOnly ? "Kilat 10 Menit" : null,
    instantOnly ? "Kirim otomatis" : null,
    effectiveMaxPrice < priceCap ? `≤ ${formatIDR(effectiveMaxPrice)}` : null,
  ].filter(Boolean) as string[];

  function resetFilters() {
    setCategory("semua");
    setGame("semua");
    setQuery("");
    setPenjual("semua");
    setOnlineOnly(false);
    setExpressOnly(false);
    setInstantOnly(false);
    setMaxPrice(priceCap);
  }

  const filterPanel = (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-ink-mute">
          Kategori
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[{ slug: "semua" as const, name: "Semua" }, ...categories].map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => setCategory(item.slug as CategorySlug | "semua")}
              className={cx(
                "rounded-control px-3.5 py-1.5 text-[12px] transition duration-200 ease-[var(--ease-astra)] active:scale-95",
                category === item.slug
                  ? "bg-astra text-white"
                  : "bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line hover:bg-canvas hover:text-ink",
              )}
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-5">
        <p className="eyebrow text-ink-mute">
          Harga maksimum
        </p>
        <input
          type="range"
          min={priceFloor}
          max={priceCap}
          step={50000}
          value={Math.min(Math.max(effectiveMaxPrice, priceFloor), priceCap)}
          onChange={(event) => setMaxPrice(Number(event.target.value))}
          aria-label="Harga maksimum"
          className="smooth-range-slider my-1"
          style={{
            background: `linear-gradient(to right, var(--color-astra) 0%, var(--color-astra) ${pricePercent}%, var(--color-line-strong) ${pricePercent}%, var(--color-line-strong) 100%)`,
          }}
        />
        <div className="flex items-center justify-between text-[11px]">
          <span className="num text-ink-mute">{formatIDR(priceFloor)}</span>
          <span className="num text-ink">{formatIDR(effectiveMaxPrice)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-line pt-5">
        <p className="eyebrow text-ink-mute">
          Kualitas layanan
        </p>
        {[
          { label: "Hanya penjual online", value: onlineOnly, set: setOnlineOnly, icon: IconCompass },
          { label: "Badge Kilat 10 Menit", value: expressOnly, set: setExpressOnly, icon: IconBolt },
          { label: "Kirim otomatis", value: instantOnly, set: setInstantOnly, icon: IconBolt },
        ].map((toggle) => (
          <button
            key={toggle.label}
            type="button"
            aria-pressed={toggle.value}
            onClick={() => toggle.set(!toggle.value)}
            className="flex items-center justify-between gap-3 rounded-well bg-canvas px-3.5 py-3 text-left text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 ease-[var(--ease-astra)] hover:bg-canvas"
          >
            <span className="flex items-center gap-2.5">
              <toggle.icon size={15} className={toggle.value ? "text-astra-ink" : "text-ink-mute"} />
              {toggle.label}
            </span>
            <span
              className={cx(
                "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-300",
                toggle.value ? "bg-astra" : "bg-canvas-2",
              )}
            >
              <span
                className={cx(
                  "absolute top-0.5 size-4 rounded-full bg-paper transition-transform duration-300 ease-[var(--ease-astra)]",
                  toggle.value ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={resetFilters}
        className="flex items-center justify-center gap-2 rounded-full bg-canvas py-2.5 text-[12px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink"
      >
        <IconX size={14} />
        Reset semua filter
      </button>
    </div>
  );

  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 pb-24 pt-12 md:px-8 md:pt-16 lg:grid-cols-[280px_1fr] lg:items-start">
      <aside className="hidden lg:block lg:sticky lg:top-24">
        <div className="bezel-shell p-1.5">
          <div className="bezel-core flex flex-col gap-6 p-5">{filterPanel}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-2 text-[13px] text-ink-mute">
              <IconCompass size={16} className="text-astra-ink" />
              Jelajah listing
            </span>
 <h1 className="font-display text-page font-extrabold text-ink md:text-page">
              Katalog Blox Astra
            </h1>
            <p className="max-w-[60ch] text-[13px] leading-relaxed text-ink-dim md:text-sm">
              {formatNumber(products.length)} listing aktif dari {formatNumber(verifiedSellers)}{" "}
              penjual terverifikasi. Semua transaksi diproses lewat penahanan dana dengan
              jaminan pengembalian dana.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex min-w-[180px] flex-1 items-center">
              <IconSearch
                size={17}
                className="pointer-events-none absolute left-3.5 text-ink-mute"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari Robux, item, atau nama toko"
                aria-label="Cari listing"
                className="h-11 w-full rounded-control bg-canvas pl-11 pr-4 text-[13px] text-ink outline outline-1 -outline-offset-1 outline-line placeholder:text-ink-mute focus:outline-2 focus:-outline-offset-2 focus:outline-astra/70"
              />
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              className="flex h-11 items-center gap-2 rounded-control bg-canvas px-4 text-[13px] text-ink-dim outline outline-1 -outline-offset-1 outline-line lg:hidden"
            >
              <IconSliders size={16} />
              Filter
              {activeFilters.length ? (
                <span className="num grid size-5 place-items-center rounded-full bg-astra text-[10px] text-white">
                  {activeFilters.length}
                </span>
              ) : null}
            </button>

            <div className="w-[9.5rem] shrink-0">
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Urutkan"
                className="h-11 rounded-control"
              >
                {SORTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="hidden shrink-0 items-center gap-0.5 rounded-control bg-canvas p-1 outline outline-1 -outline-offset-1 outline-line sm:flex">
              {(
                [
                  { id: "grid" as View, icon: IconGrid, label: "Tampilan grid" },
                  { id: "row" as View, icon: IconRows, label: "Tampilan daftar" },
                ]
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-label={option.label}
                  aria-pressed={view === option.id}
                  onClick={() => setView(option.id)}
                  className={cx(
                    "grid size-8 place-items-center rounded-control transition-colors duration-200",
                    view === option.id ? "bg-canvas text-ink" : "text-ink-mute",
                  )}
                >
                  <option.icon size={15} />
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden lg:hidden"
              >
                <div className="bezel-shell p-1.5">
                  <div className="bezel-core p-5">{filterPanel}</div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <span className="text-[11px] text-ink-mute">
              <span className="num text-ink-dim">
                {rangeFrom}–{rangeTo}
              </span>{" "}
              dari <span className="num text-ink-dim">{results.length}</span> hasil
            </span>
            {activeFilters.map((filter) => (
              <Badge key={filter} tone="astra">
                {filter}
              </Badge>
            ))}
            {activeFilters.length ? (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-ink-mute underline decoration-dotted underline-offset-4 hover:text-ink"
              >
                bersihkan
              </button>
            ) : null}
          </div>
        </div>

        {pending ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="bezel-shell p-1.5">
                <div className="bezel-core flex flex-col gap-3 p-2.5">
                  <Skeleton className="aspect-[4/3] w-full rounded-card" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex items-center justify-between pt-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="size-7 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={<IconSearch size={22} />}
            title="Tidak ada listing yang cocok"
            description="Coba longgarkan filter harga, matikan filter penjual online, atau cari dengan kata kunci game yang lebih pendek."
            action={
              <Button variant="secondary" onClick={resetFilters}>
                Reset filter
              </Button>
            }
          />
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                seller={sellers[product.sellerId]}
                className="animate-[rise_0.5s_var(--ease-out-expo)_both]"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                wishlisted={wishlistSet.has(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visible.map((product) => (
              <ProductRow key={product.id} product={product} seller={sellers[product.sellerId]} />
            ))}
          </div>
        )}

        {totalPages > 1 && !pending ? (
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => {
                setPage(safePage - 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Sebelumnya
            </Button>
            <span className="num text-[12px] text-ink-mute">
              Halaman {safePage} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => {
                setPage(safePage + 1);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              Berikutnya
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProductRow({ product, seller }: { product: Product; seller: Seller }) {
  return (
    <div className="animate-[rise_0.5s_var(--ease-out-expo)_both]">
      <div className="bezel-shell p-1.5">
        <div className="bezel-core flex items-center gap-4 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">
                {product.game}
              </span>
              {seller.avgDeliverySeconds <= EXPRESS_SLA_SECONDS ? (
                <Badge tone="astra" icon={<IconBolt size={11} />}>
                  Kilat 10 Menit
                </Badge>
              ) : null}
            </div>
            <a
              href={`/produk/${product.slug}`}
              className="truncate text-[15px] font-bold text-ink transition-colors duration-300 hover:text-astra-ink"
            >
              {product.title}
            </a>
            <div className="flex items-center gap-3">
              <SellerAvatar name={seller.storeName} size={24} online={seller.isOnline} />
              <span className="text-[11px] text-ink-dim">{seller.storeName}</span>
              <StarRating rating={seller.rating} size={10} />
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="num text-[15px] font-extrabold text-ink">{formatIDR(product.price)}</span>
            <span className="text-[11px] text-ink-mute">
              stok <span className="num text-ink-dim">{formatNumber(product.stock)}</span>
            </span>
            <a
              href={`/produk/${product.slug}`}
              className="mt-1 rounded-full bg-astra/[0.07] px-3 py-1.5 text-[11px] font-bold text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20 transition-colors duration-300 hover:bg-astra/[0.12]"
            >
              Lihat detail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
