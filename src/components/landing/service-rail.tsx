"use client";

import Link from "next/link";
import { cx } from "@/lib/cx";
import { useMemo, type ReactNode } from "react";
import { formatIDR } from "@/lib/format";
import {
  robuxOrderConfig,
  robuxOrderPrice,
  type RobuxOrderKind,
} from "@/lib/robux-orders";
import { productPrice } from "@/lib/robux-pricing";
import type { Product } from "@/lib/types";
import { useRateStore } from "@/components/rates/rate-store";
import {
  IconChevronRight,
  IconCrown,
  IconGift,
  IconHexCoin,
  IconPackage,
  IconUserSquare,
} from "@/components/ui/icons";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import type { ServiceArt } from "@/lib/service-art-slots";

type BadgeTone = "diskon" | "populer" | "terlaris" | "limited" | "premium" | "kilat" | "habis";

/* Only two of these fills carry meaning — brand red for a price cut, gold for
   the best seller. Everything else is a quiet neutral chip. Six coloured pills
   on one shelf turned four entry points into four competing tribes; a shelf
   reads as one shelf. */
const QUIET = "bg-canvas-2 text-ink-dim outline-line";

const BADGES: Record<BadgeTone, { label: string; className: string }> = {
  diskon: { label: "Diskon", className: "bg-astra text-white outline-astra-deep" },
  terlaris: { label: "Terlaris", className: "bg-gold text-on-gold outline-gold" },
  populer: { label: "Populer", className: QUIET },
  limited: { label: "Limited", className: QUIET },
  premium: { label: "Premium", className: QUIET },
  kilat: { label: "Kilat", className: QUIET },
  habis: { label: "Habis", className: "bg-canvas text-ink-mute outline-line-strong" },
};

/** Icon per product category — purely presentational, not data. */
const CATEGORY_ICONS: Record<string, (props: { size?: number }) => ReactNode> = {
  gamepass: IconHexCoin,
  item: IconPackage,
  gift: IconGift,
  akun: IconUserSquare,
  premium: IconCrown,
};

interface ServiceCard {
  key: string;
  name: string;
  via: string;
  badge: BadgeTone;
  icon: (props: { size?: number }) => ReactNode;
  href: string;
  soldOut: boolean;
  price?: string;
}

interface MethodEntry {
  kind: RobuxOrderKind;
  via: string;
  badge: BadgeTone;
  href: string;
}

/** Fixed entry points for the /beli/* flows (not catalog rows). */
const METHOD_ENTRIES: MethodEntry[] = [
  { kind: "username", via: "Via Username", badge: "populer", href: "/beli/robux-username" },
  { kind: "login", via: "Via Login", badge: "kilat", href: "/beli/robux-login" },
  { kind: "gamepass", via: "Via Gamepass", badge: "terlaris", href: "/beli/robux-gamepass" },
  { kind: "premium", via: "Via Penjual", badge: "premium", href: "/beli/premium" },
];

/**
 * The shelf. Entry points run as one horizontal row that keeps going past the
 * right edge, rather than a grid of equal cards: four identical tiles in a row
 * is the layout every generated page reaches for, and the cut-off edge is what
 * tells a shopper there is more to scroll.
 *
 * Tiles are left-aligned. Centring the icon, the name, the price and the CTA in
 * every tile made the four read as one repeated object; a shelf label stacks
 * from a common left edge instead.
 *
 * Catalog-backed cards come from products flagged `shelf = "service"`; the four
 * Robux flows are fixed navigation targets quoted live from the rate card.
 * Nothing here is a literal price.
 */
export function ServiceRail({
  products,
  art = {},
}: {
  products: Product[];
  /** Admin-uploaded artwork per slot, keyed like `ServiceCard.key`. */
  art?: ServiceArt;
}) {
  const { rates } = useRateStore();

  const cards = useMemo<ServiceCard[]>(() => {
    const catalogCards: ServiceCard[] = products
      .filter((product) => product.shelf === "service")
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((product) => {
        const soldOut = product.stock <= 0;
        const Icon = CATEGORY_ICONS[product.category] ?? IconPackage;
        return {
          key: product.slug,
          name: product.game,
          via: product.category === "gift" ? "Kode Redeem" : product.category,
          badge: soldOut ? "habis" : "populer",
          icon: Icon,
          href: `/produk/${product.slug}`,
          soldOut,
          price: soldOut ? undefined : formatIDR(productPrice(product, rates.card)),
        };
      });

    // Fixed flow entries quote live from the rate card — no catalog rows needed.
    const methodCards: ServiceCard[] = METHOD_ENTRIES.map((entry) => {
      if (entry.kind === "premium") {
        return {
          key: "premium",
          name: "Roblox Premium",
          via: entry.via,
          badge: entry.badge,
          icon: IconCrown,
          href: entry.href,
          soldOut: false,
          price: `${formatIDR(rates.orders.premium)} / bulan`,
        };
      }
      const config = robuxOrderConfig(entry.kind, rates.orders);
      return {
        key: `robux-${entry.kind}`,
        name: "Robux",
        via: entry.via,
        badge: entry.badge,
        icon: IconHexCoin,
        href: entry.href,
        soldOut: false,
        price: formatIDR(robuxOrderPrice(config, config.initialRobux)),
      };
    });

    return [...methodCards, ...catalogCards];
  }, [products, rates]);

  if (!cards.length) return null;

  return (
    <section className="px-4 pb-8 pt-8 md:px-8 md:pb-12 md:pt-12">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <Reveal>
          <div className="flex flex-col gap-2">
            <h2 className="text-title font-extrabold text-ink">Top up instan Blox Astra</h2>
            <p className="text-[13px] text-ink-dim md:text-sm">
              Dijalankan platform, dikerjakan penjual terverifikasi — dana tetap ditahan sampai
              Robux masuk. Butuh paket stok toko? Lanjut ke rak di bawah.
            </p>
          </div>
        </Reveal>

        {/* A rail at every width, never a grid: the row ends past the right edge
            so the shelf visibly continues instead of closing as a neat set.

            `pt-2 -mt-2` is load-bearing, not spacing. `overflow-x-auto` makes
            the vertical axis clip too, so the 3px `lift` on each tile was
            being shaved off at the container's top edge on hover — the tile's
            top looked like it collapsed. The padding gives the lift somewhere
            to go; the negative margin cancels the shift it would otherwise
            add, so the row sits exactly where it did before. */}
        <RevealGroup
          className="no-scrollbar -mx-4 -mt-2 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 pt-2 md:mx-0 md:px-0"
        >
          {cards.map((service) => {
            const badge = BADGES[service.badge];
            const Icon = service.icon;
            const soldOut = service.soldOut;
            const price = service.price;
            const customArt = art[service.key as keyof ServiceArt];
            return (
              <RevealItem key={`${service.name}-${service.via}`} className="h-full">
                <Link
                  href={service.href}
                  aria-disabled={soldOut || undefined}
                  tabIndex={soldOut ? -1 : undefined}
                  className={cx(
                    // `min-w` keeps the row scrollable once it overflows, while
                    // `flex-1` lets four tiles fill the shelf instead of leaving
                    // half the row empty — the same rail either way.
                    "group lift relative flex h-full min-w-[180px] flex-1 shrink-0 snap-start flex-col gap-3 rounded-card bg-paper p-3.5 outline outline-1 -outline-offset-1 outline-line transition-[outline-color,transform] duration-300 ease-[var(--ease-astra)] sm:min-w-[196px]",
                    soldOut ? "pointer-events-none" : "hover:outline-astra/50",
                  )}
                >
                  <span
                    className={cx(
                      "w-fit rounded-tag px-2 py-1 tag outline outline-1 -outline-offset-1",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>

                  {/* The icon sits straight on the tile at cover-art size.
                      Boxing it in a rounded plate at every scale was what made
                      every surface in the old design read as the same object.

                      An admin-uploaded image replaces the icon where one is
                      set. `object-contain`, not `cover`: these are logos and
                      artwork, and cropping the edges off a logo is worse than
                      leaving a little empty space around it. */}
                  <span
                    aria-hidden
                    className={cx(
                      "pointer-events-none mt-1 flex h-[62px] items-center",
                      soldOut ? "text-ink-mute" : "text-astra-ink",
                    )}
                  >
                    {customArt ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={customArt}
                        alt=""
                        className={cx(
                          "size-[62px] rounded-control object-contain",
                          soldOut && "opacity-50 grayscale",
                        )}
                      />
                    ) : (
                      <Icon size={40} />
                    )}
                  </span>

                  <span className="flex flex-col gap-1">
                    <span
                      className={cx(
                        "font-display text-[15px] font-extrabold uppercase leading-none tracking-tight",
                        soldOut ? "text-ink-mute" : "text-ink",
                      )}
                    >
                      {service.name}
                    </span>
                    <span className="tag text-ink-mute">{service.via}</span>
                  </span>

                  {/* Footer carries the price and one moving chevron. An
                      "Pilih metode" label repeated on every tile said nothing
                      the tile was not already saying by being a link. */}
                  <span className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
                    {soldOut ? (
                      <span className="tag text-ink-mute">Habis</span>
                    ) : (
                      <span className="price text-[15px] text-gold">{price}</span>
                    )}
                    <IconChevronRight
                      size={14}
                      className={cx(
                        "shrink-0 transition-[transform,color] duration-200 ease-[var(--ease-astra)]",
                        soldOut
                          ? "text-ink-mute"
                          : "text-ink-mute group-hover:translate-x-0.5 group-hover:text-astra-ink",
                      )}
                    />
                  </span>
                </Link>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
