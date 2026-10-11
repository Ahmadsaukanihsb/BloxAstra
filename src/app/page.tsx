import type { Metadata } from "next";
import { getProducts, getSellerMap } from "@/lib/catalog";
import { FeaturedListings } from "@/components/landing/featured-listings";
import { GameRail } from "@/components/landing/game-rail";
import { Hero } from "@/components/landing/hero";
import { LimitedRedeem } from "@/components/landing/limited-redeem";
import { PremiumPlans } from "@/components/landing/premium-plans";
import { RobuxPacks } from "@/components/landing/robux-packs";
import { ServiceRail } from "@/components/landing/service-rail";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export default async function HomePage() {
  const [products, sellers] = await Promise.all([getProducts(), getSellerMap()]);
  return (
    <>
      {/* Banner → games → services → Robux nominal → Premium → Limited/Redeem → shelf. */}
      <Hero />
      <GameRail products={products} />
      <ServiceRail products={products} />
      <RobuxPacks products={products} />
      <PremiumPlans />
      <LimitedRedeem products={products} />
      <FeaturedListings products={products} sellers={sellers} />
    </>
  );
}
