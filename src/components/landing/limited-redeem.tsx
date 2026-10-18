"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatIDR } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductArt } from "@/components/ui/art";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { IconCrown, IconGift } from "@/components/ui/icons";
import { EmptyRow } from "@/components/landing/shelf-empty";

/**
 * Two side-by-side shelves. Both are DB-driven: the "Limited" side reads
 * products whose `shelf` is "limited", the "Redeem" side reads `shelf` "redeem".
 * Nothing is hardcoded — curate by flipping the shelf column on a product.
 */
export function LimitedRedeem({ products }: { products: Product[] }) {
  const { limited, redeem } = useMemo(() => {
    const limited = products
      .filter((product) => product.shelf === "limited")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const redeem = products
      .filter((product) => product.shelf === "redeem")
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return { limited, redeem };
  }, [products]);

  // Both columns always render. A shelf with nothing in it keeps its heading and
  // swaps the grid for a status line, so the pair stays balanced when only one
  // side has stock — which is the common case, not the exception.
  return (
    <section className="px-4 py-10 md:px-8 md:py-14">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col gap-5">
          <Reveal>
            <ShelfHead
              icon={<IconCrown size={20} className="text-warn" />}
              title="Koleksi"
              accent="Limited"
              href="/katalog?kategori=item"
            />
          </Reveal>
          {limited.length === 0 ? (
            <Reveal>
              <EmptyRow
                label="Belum ada koleksi limited"
                body="Rak ini diisi penjual dari item terbatas milik mereka. Punya stok item? Pasang listing dan rak ini ikut terisi."
                icon={<IconCrown size={17} />}
                secondary={{ href: "/dashboard/penjual", label: "Jual di Blox Astra" }}
              />
            </Reveal>
          ) : null}
          <RevealGroup className="grid grid-cols-2 gap-3.5 sm:grid-cols-4" stagger={0.05}>
            {limited.map((product) => (
              <RevealItem key={product.slug} className="h-full">
                <Link
                  href={`/produk/${product.slug}`}
                  className="group flex h-full flex-col gap-2.5 rounded-card border border-astra/20 bg-paper p-2.5 transition-[transform,translate,scale,rotate,border-color] duration-500 ease-[var(--ease-astra)] hover:-translate-y-1 hover:border-astra/50"
                >
                  <ProductArt
                    seed={product.slug}
                    category={product.category}
                    className="aspect-square w-full rounded-well"
                  />
                  <span className="line-clamp-2 px-0.5 text-[11px] font-bold leading-snug text-ink">
                    {product.title}
                  </span>
                  <span className="num mt-auto px-0.5 text-[13px] font-extrabold text-astra-ink">
                    {formatIDR(product.price)}
                  </span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        <div className="flex flex-col gap-5">
          <Reveal>
            <ShelfHead
              icon={<IconGift size={20} className="text-astra-ink" />}
              title="Kode"
              accent="Redeem"
              href="/katalog?kategori=gift"
            />
          </Reveal>
          {redeem.length === 0 ? (
            <Reveal>
              <EmptyRow
                label="Belum ada kode redeem"
                body="Kode Robux dan hadiah dari penjual tampil di sini begitu dipasang — pembeli melihat sisa kodenya langsung."
                icon={<IconGift size={17} />}
              />
            </Reveal>
          ) : null}
          <RevealGroup className="grid grid-cols-2 gap-3.5 sm:grid-cols-4" stagger={0.05}>
            {redeem.map((product) => (
              <RevealItem key={product.slug} className="h-full">
                <Link
                  href={`/produk/${product.slug}`}
                  className="group flex h-full flex-col gap-2.5 rounded-card border border-astra/20 bg-paper p-2.5 transition-[transform,translate,scale,rotate,border-color] duration-500 ease-[var(--ease-astra)] hover:-translate-y-1 hover:border-astra/50"
                >
                  <ProductArt
                    seed={product.slug}
                    category={product.category}
                    label={product.title.match(/\$\d+/)?.[0]}
                    className="aspect-square w-full rounded-well"
                  />
                  <span className="line-clamp-2 px-0.5 text-[11px] font-bold leading-snug text-ink">
                    {product.title}
                  </span>
                  <span className="num mt-auto px-0.5 text-[13px] font-extrabold text-astra-ink">
                    {formatIDR(product.price)}
                  </span>
                </Link>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </div>
    </section>
  );
}

function ShelfHead({
  icon,
  title,
  accent,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  href: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
 <h2 className="flex items-center gap-2 text-title font-extrabold text-ink md:text-title">
        {icon}
        {title} <span className="text-astra-ink">{accent}</span>
      </h2>
      <Link
        href={href}
        className="shrink-0 rounded-full border border-line bg-paper px-4 py-1.5 text-[12px] font-bold text-ink transition-colors duration-300 hover:border-astra/40 hover:text-astra-ink"
      >
        Lihat semua
      </Link>
    </div>
  );
}
