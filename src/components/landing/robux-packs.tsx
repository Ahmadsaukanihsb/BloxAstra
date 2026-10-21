"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatIDR, formatNumber } from "@/lib/format";
import { listingQuote } from "@/lib/robux-pricing";
import type { Product } from "@/lib/types";
import { useRateCard } from "@/components/rates/rate-store";
import { SectionHeading } from "@/components/ui/surface";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { IconArrowRight, IconPackage, RobuxGlyph } from "@/components/ui/icons";
import { ShelfEmpty } from "@/components/landing/shelf-empty";

export function RobuxPacks({ products }: { products: Product[] }) {
  const rateCard = useRateCard();

  const packs = useMemo(() => {
    const shelfPacks = products
      .filter((product) => product.shelf === "pack" && product.netRobux)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const maxSold = Math.max(...shelfPacks.map((product) => product.sold), 0);
    return shelfPacks.map((product) => {
      let badge: string;
      if (product.sold === maxSold && maxSold > 0) badge = "Terlaris";
      else if (product.compareAtPrice) badge = "Hemat";
      else if ((product.netRobux ?? 0) <= 500) badge = "Pemula";
      else badge = "Populer";
      return {
        slug: product.slug,
        badge,
        robux: product.netRobux ?? 0,
        price: listingQuote(
          product.netRobux ?? 0,
          product.pricingMode ?? "cover",
          1,
          rateCard,
        ).totalIdr,
      };
    });
  }, [products, rateCard]);

  // The packs shelf is seller stock, but Robux itself is not: the platform's
  // own gamepass flow keeps selling with an empty catalog, so that is what this
  // section offers the moment it has no packs of its own to show.
  if (!packs.length) {
    return (
      <ShelfEmpty
        title={
          <>
            Robux <span className="text-astra-ink">Bersih</span>
          </>
        }
        description="Paket di rak ini dipasang penjual dari stok mereka — belum ada yang aktif hari ini."
        action={{ href: "/beli/robux-gamepass", label: "Beli via gamepass", variant: "primary" }}
        label="Belum ada paket dari penjual"
        body="Gamepass milik platform selalu tersedia: pajak 30% kami yang tanggung dan Robux masuk ke akunmu sendiri."
        icon={<IconPackage size={17} />}
        secondary={{ href: "/katalog?kategori=gamepass", label: "Lihat katalog" }}
      />
    );
  }

  return (
    <section className="px-4 py-14 md:px-8 md:py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <Reveal>
          <SectionHeading
            align="between"
            title={
              <>
                Paket Robux <span className="text-astra-ink">dari penjual</span>
              </>
            }
            description="Stok milik toko terverifikasi — harga dan pengiriman mengikuti masing-masing penjual. Mau instan tanpa pilih toko? Pakai kalkulator di atas."
            action={
              <ButtonLink
                href="/katalog?kategori=gamepass"
                variant="secondary"
                trailingIcon={<IconArrowRight size={16} />}
                iconCircleClassName="bg-canvas"
              >
                Lihat semua
              </ButtonLink>
            }
          />
        </Reveal>

        <RevealGroup
          className="grid grid-cols-2 gap-3.5 lg:grid-cols-5 lg:gap-4"
        >
          {packs.map((pack) => (
            <RevealItem key={pack.slug} className="h-full">
              <div className="relative flex h-full flex-col items-center gap-3 rounded-card border border-line bg-paper px-4 pb-4 pt-6 text-center">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-astra px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-white">
                  {pack.badge}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="num text-[19px] font-extrabold text-ink">
                    {formatNumber(pack.robux)}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-astra-ink">
                    Robux
                  </span>
                </span>
                <span className="grid size-11 place-items-center rounded-control bg-canvas-2 text-robux">
                  <RobuxGlyph size={22} />
                </span>
                <span className="num mt-auto text-[15px] font-extrabold text-astra-ink">
                  {formatIDR(pack.price)}
                </span>
                <Link
                  href={`/produk/${pack.slug}`}
                  className="accent-fill flex h-10 w-full items-center justify-center rounded-control text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition-[filter] duration-300 hover:brightness-[1.08]"
                >
                  Beli sekarang
                </Link>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
