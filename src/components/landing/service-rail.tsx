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
  IconArrowRight,
  IconCrown,
  IconGift,
  IconHexCoin,
  IconPackage,
  IconUserSquare,
} from "@/components/ui/icons";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";

type BadgeTone = "diskon" | "populer" | "terlaris" | "limited" | "premium" | "kilat" | "habis";

const BADGES: Record<BadgeTone, { label: string; className: string }> = {
  diskon: { label: "Diskon", className: "bg-astra text-white" },
  populer: { label: "Populer", className: "bg-[#2563eb] text-white" },
  terlaris: { label: "Terlaris", className: "bg-[#f59e0b] text-white" },
  limited: { label: "Limited", className: "bg-astra-deep text-white" },
  premium: { label: "Premium", className: "bg-[#7c3aed] text-white" },
  kilat: { label: "Kilat", className: "bg-[#0284c7] text-white" },
  habis: { label: "Stok habis", className: "bg-ink-mute text-white" },
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
 * Service entry rail. Catalog-backed cards come from products flagged
 * `shelf = "service"`; the two robux flows are fixed navigation targets whose
 * price is quoted live from the rate card. Nothing here is a literal price.
 */
export function ServiceRail({ products }: { products: Product[] }) {
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
    <section className="px-4 pb-8 pt-6 md:px-8 md:pb-10 md:pt-10">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-7">
        <Reveal>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[1.6rem] font-extrabold leading-tight tracking-[-0.03em] text-ink md:text-[2rem]">
              Pilihan Layanan & <span className="text-astra">Kategori</span>
            </h2>
            <p className="text-[13px] text-ink-dim md:text-sm">
              Temukan metode top up Robux, item gamepass, dan kebutuhan Roblox kamu
            </p>
          </div>
        </Reveal>

        <RevealGroup
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-3 pt-4 sm:grid sm:grid-cols-2 md:mx-0 md:px-0 lg:grid-cols-4 lg:gap-4 lg:overflow-visible"
          stagger={0.04}
        >
          {cards.map((service) => {
            const badge = BADGES[service.badge];
            const Icon = service.icon;
            const soldOut = service.soldOut;
            const price = service.price;
            return (
              <RevealItem key={`${service.name}-${service.via}`} className="h-full">
                <Link
                  href={service.href}
                  aria-disabled={soldOut || undefined}
                  tabIndex={soldOut ? -1 : undefined}
                  className={cx(
                    "relative flex h-full w-[152px] shrink-0 snap-start flex-col items-center gap-3 rounded-3xl border-2 bg-paper px-3 pb-4 pt-6 text-center transition-[transform,translate,scale,rotate,border-color,box-shadow] duration-500 ease-[var(--ease-astra)] hover:-translate-y-1 hover:shadow-[0_18px_34px_-26px_rgba(225,29,72,0.55)] md:w-full",
                    soldOut
                      ? "border-line pointer-events-none"
                      : "border-astra/30 hover:border-astra/70",
                    service.badge === "diskon" && !soldOut && "bg-astra-wash",
                  )}
                >
                  <span
                    className={cx(
                      "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em]",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>

                  <span
                    className={cx(
                      "grid size-14 place-items-center rounded-2xl",
                      soldOut ? "bg-canvas text-ink-mute" : "bg-astra-wash text-astra",
                    )}
                  >
                    <Icon size={26} />
                  </span>

                  <span className="flex flex-col gap-0.5">
                    <span
                      className={cx(
                        "text-[13px] font-extrabold uppercase tracking-[0.04em]",
                        soldOut ? "text-ink-mute" : "text-ink",
                      )}
                    >
                      {service.name}
                    </span>
                    <span
                      className={cx(
                        "text-[10px] font-extrabold uppercase tracking-[0.04em]",
                        soldOut ? "text-ink-mute" : "text-astra",
                      )}
                    >
                      {service.via}
                    </span>
                  </span>

                  {soldOut ? (
                    <span className="mt-auto flex w-full flex-col items-center gap-1 px-2 py-2">
                      <span className="text-[10px] text-ink-mute">Tidak tersedia</span>
                    </span>
                  ) : (
                    <span className="mt-auto flex w-full flex-col items-center gap-1 rounded-2xl bg-astra-wash px-2 py-2">
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-astra-deep">
                        Tersedia
                      </span>
                      <span className="num text-[12px] font-extrabold text-astra-deep">
                        {price}
                      </span>
                    </span>
                  )}

                  <span
                    className={cx(
                      "flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-[0.08em]",
                      soldOut ? "text-ink-mute" : "text-astra",
                    )}
                  >
                    {soldOut ? "Habis" : "Pilih"}
                    <IconArrowRight size={12} />
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
