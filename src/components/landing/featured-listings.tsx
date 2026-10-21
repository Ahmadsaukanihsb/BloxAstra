import { ProductCard } from "@/components/product/product-card";
import { SectionHeading } from "@/components/ui/surface";
import { Reveal, RevealGroup, RevealItem } from "@/components/ui/reveal";
import { ButtonLink } from "@/components/ui/button";
import { IconArrowRight, IconStar } from "@/components/ui/icons";
import { ShelfEmpty } from "@/components/landing/shelf-empty";
import type { LandingSignals, Product, Seller } from "@/lib/types";

/**
 * A single calm grid. Leaderboards and vendor lists live on the catalog and
 * dashboard where people actually shop — the home page only needs the shelf.
 * Featured items are flagged in the DB (`Product.featured`) so curation is a
 * data change, not a code change.
 */
export function FeaturedListings({
  products,
  sellers,
  signals,
}: {
  products: Product[];
  sellers: Record<string, Seller>;
  signals?: LandingSignals;
}) {
  const featured = products.filter((product) => product.featured).slice(0, 4);

  // The closing shelf of the page. With nothing curated it still closes the
  // page: the proof line lands here a second time (see the note in page.tsx)
  // and the seller door stays open, because an empty shelf here is a supply
  // problem, not a demand one.
  if (!featured.length) {
    return (
      <ShelfEmpty
        title="Listing pilihan minggu ini"
        description="Kurasi manual dari stok yang aktif — belum ada listing yang bisa dipilih minggu ini."
        action={{ href: "/katalog", label: "Jelajahi katalog" }}
        label="Rak pilihan masih kosong"
        body="Top up Robux lewat username, login, atau gamepass tetap bisa dibeli sekarang — jalur itu tidak menunggu stok penjual."
        icon={<IconStar size={17} />}
        signals={signals}
        secondary={{ href: "/dashboard/penjual", label: "Jual listing pertamamu" }}
      />
    );
  }

  return (
    <section className="px-4 py-14 md:px-8 md:py-20">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-8">
        <Reveal>
          <SectionHeading
            align="between"
            title="Listing pilihan minggu ini"
            description="Dipilih manual dari stok yang aktif, lengkap dengan status verifikasi penjual dan catatan waktu serah terima."
            action={
              <ButtonLink
                href="/katalog"
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
          className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {featured.map((product) => (
            <RevealItem key={product.slug} className="h-full">
              <ProductCard product={product} seller={sellers[product.sellerId]} className="h-full" />
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
