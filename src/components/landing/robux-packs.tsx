"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatIDR } from "@/lib/format";
import { listingQuote } from "@/lib/robux-pricing";
import type { Product } from "@/lib/types";
import { useRateCard } from "@/components/rates/rate-store";
import { SectionHeading } from "@/components/ui/surface";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { IconArrowRight, RobuxGlyph } from "@/components/ui/icons";

export function RobuxPacks({ products }: { products: Product[] }) {
  const rateCard = useRateCard();
  const [custom, setCustom] = useState("100");
  const customValue = Number(custom.replace(/\D/g, "") || "0");
  const customPrice = listingQuote(customValue, "cover", 1, rateCard).totalIdr;

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

  if (!packs.length) return null;

  return (
    <section className="px-4 py-14 md:px-8 md:py-16">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <Reveal>
          <SectionHeading
            align="between"
            title={
              <>
                Robux <span className="text-astra">Bersih</span>
              </>
            }
            description="Pajak 30% sudah dicover • Robux masuk ke akunmu sendiri"
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
          stagger={0.05}
        >
          {/* custom nominal */}
          <RevealItem className="h-full">
            <div className="relative flex h-full flex-col items-center gap-3 rounded-3xl border-2 border-astra bg-paper px-4 pb-4 pt-6 text-center shadow-[0_18px_40px_-30px_rgba(225,29,72,0.6)]">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-astra px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-white">
                Bebas
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-[17px] font-extrabold text-ink">Custom</span>
                <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-astra">
                  Nominal
                </span>
              </span>
              <label className="flex w-full items-center gap-2 rounded-2xl border border-line bg-paper px-3 py-2">
                <input
                  value={custom}
                  onChange={(event) => setCustom(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  aria-label="Nominal Robux"
                  className="num w-full bg-transparent text-center text-[15px] font-extrabold text-ink outline-none"
                />
              </label>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-ink-mute">
                Robux
              </span>
              <span className="num mt-auto text-[15px] font-extrabold text-astra">
                {formatIDR(customPrice)}
              </span>
              <Link
                href="/katalog?kategori=gamepass"
                className="accent-gradient flex h-10 w-full items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition-[filter] duration-300 hover:brightness-[1.08]"
              >
                Beli sekarang
              </Link>
            </div>
          </RevealItem>

          {packs.map((pack) => (
            <RevealItem key={pack.slug} className="h-full">
              <div className="relative flex h-full flex-col items-center gap-3 rounded-3xl border border-line bg-paper px-4 pb-4 pt-6 text-center">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-astra px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.06em] text-white">
                  {pack.badge}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="num text-[19px] font-extrabold text-ink">
                    {pack.robux.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-astra">
                    Robux
                  </span>
                </span>
                <span className="grid size-11 place-items-center rounded-xl bg-canvas-2 text-robux">
                  <RobuxGlyph size={22} />
                </span>
                <span className="num mt-auto text-[15px] font-extrabold text-astra">
                  {formatIDR(pack.price)}
                </span>
                <Link
                  href={`/produk/${pack.slug}`}
                  className="accent-gradient flex h-10 w-full items-center justify-center rounded-full text-[11px] font-extrabold uppercase tracking-[0.06em] text-white transition-[filter] duration-300 hover:brightness-[1.08]"
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
