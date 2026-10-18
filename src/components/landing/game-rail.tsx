"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatIDR } from "@/lib/format";
import type { CategorySlug, LandingSignals, Product } from "@/lib/types";
import { ProductArt } from "@/components/ui/art";
import { SectionHeading } from "@/components/ui/surface";
import { Reveal } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { IconArrowRight, IconCompass } from "@/components/ui/icons";
import { ShelfEmpty } from "@/components/landing/shelf-empty";
import { useCatalog } from "@/components/rates/rate-store";

/**
 * Horizontal game rail — derived entirely from the live catalog. Each distinct
 * `game` in the products becomes a card; counts, starting price, and the art
 * category all come from the data so nothing can go stale.
 */
export function GameRail({
  products,
  signals,
}: {
  products: Product[];
  signals?: LandingSignals;
}) {
  const catalog = useCatalog(products);
  const rail = useMemo(() => {
    const byGame = new Map<
      string,
      { count: number; from: number | null; art: CategorySlug }
    >();
    for (const product of catalog) {
      const entry = byGame.get(product.game) ?? {
        count: 0,
        from: null,
        art: product.category,
      };
      entry.count += 1;
      entry.from =
        entry.from === null ? product.price : Math.min(entry.from, product.price);
      byGame.set(product.game, entry);
    }
    return [...byGame.entries()]
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [catalog]);

  // A bare rail keeps the section: the heading still promises a way in, the
  // line under it says the catalog is empty, and the one door that works today
  // is offered instead of the doorway that has nothing behind it.
  if (!rail.length) {
    return (
      <ShelfEmpty
        title="Mulai dari game yang kamu mainkan"
        description="Pintu masuk per game dihitung langsung dari listing aktif — hari ini belum ada satu pun yang dipasang penjual."
        action={{ href: "/beli/robux-username", label: "Top up langsung", variant: "primary" }}
        label="Rak per game masih kosong"
        body="Jalur username tidak menunggu stok siapa pun: pilih nominal, bayar, dan Robux dikirim dari pool platform."
        icon={<IconCompass size={17} />}
        signals={signals}
        secondary={{ href: "/katalog", label: "Lihat katalog" }}
      />
    );
  }

  return (
    <section className="px-4 pb-4 pt-16 md:px-8 md:pt-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <Reveal>
          <SectionHeading
            align="between"
            title="Mulai dari game yang kamu mainkan"
            description="Setiap pintu masuk katalog dihitung langsung dari listing aktif hari ini, lengkap dengan harga terendah."
            action={
              <ButtonLink
                href="/katalog"
                variant="secondary"
                trailingIcon={<IconArrowRight size={16} />}
                iconCircleClassName="bg-canvas"
                className="hidden md:inline-flex"
              >
                Semua listing
              </ButtonLink>
            }
          />
        </Reveal>

        <Reveal delay={0.06}>
          {/* `pt-2 -mt-2` exists so the 4px hover lift has room: `overflow-x-auto`
              clips the vertical axis as well, so without it the top of a tile
              was cut off the moment you pointed at it. The negative margin
              cancels the padding's shift, leaving the row where it was. */}
          <div className="no-scrollbar -mx-4 -mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 pt-2 md:mx-0 md:px-0">
            {rail.map((game) => (
              <Link
                key={game.name}
                href={`/katalog?game=${encodeURIComponent(game.name)}`}
                className="group flex w-[156px] shrink-0 snap-start flex-col gap-2.5 rounded-well bg-paper p-2.5 outline outline-1 -outline-offset-1 outline-line transition-[transform,translate,scale,rotate,box-shadow,outline-color] duration-500 ease-[var(--ease-astra)] hover:-translate-y-1 hover:shadow-[0_14px_30px_-20px_rgba(16,24,40,0.3)] hover:outline-astra/35 sm:w-[168px]"
              >
                <ProductArt
                  seed={game.name}
                  category={game.art}
                  className="aspect-square w-full rounded-control"
                  glyphClassName="opacity-90"
                />
                <div className="flex flex-col gap-1 px-0.5 pb-0.5">
                  <span className="truncate text-[13px] font-bold text-ink">{game.name}</span>
                  <span className="flex items-center justify-between gap-2">
                    {game.from !== null ? (
                      <span className="num text-[11px] font-extrabold text-astra-ink">
                        {formatIDR(game.from)}
                      </span>
                    ) : (
                      <span className="text-[11px] text-ink-mute">—</span>
                    )}
                    <span className="num text-[10px] text-ink-mute">{game.count} listing</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
