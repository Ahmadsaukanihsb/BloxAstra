import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getProducts, getSellerMap } from "@/lib/catalog";
import { getRecentReviews } from "@/lib/orders";
import { getLandingSignals } from "@/lib/landing";
import { getServiceArt } from "@/lib/service-art";
import { getSitePopup } from "@/lib/site-notice";
import { getLandingLayout, visibleSections } from "@/lib/landing-sections";
import { HomePopup } from "@/components/site/home-popup";
import { FeaturedListings } from "@/components/landing/featured-listings";
import { GameRail } from "@/components/landing/game-rail";
import { Hero } from "@/components/landing/hero";
import { HowToOrder } from "@/components/landing/how-to-order";
import { LimitedRedeem } from "@/components/landing/limited-redeem";
import { PremiumPlans } from "@/components/landing/premium-plans";
import { RobuxPacks } from "@/components/landing/robux-packs";
import { ServiceRail } from "@/components/landing/service-rail";
import { Testimonials } from "@/components/landing/testimonials";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/", images: [{ url: "/opengraph-image", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
};

export default async function HomePage() {
  const [products, sellers, serviceArt, signals, reviews, layout, popup] = await Promise.all([
    getProducts(),
    getSellerMap(),
    getServiceArt(),
    getLandingSignals(),
    getRecentReviews(),
    getLandingLayout(),
    getSitePopup(),
  ]);

  // Sections below the hero follow the admin-arranged order (/admin tab
  // Beranda); hidden ones are skipped. The hero itself is always first.
  // Every rail below is built from the live catalog, so each one can come up
  // bare. They no longer disappear when that happens — they hand the reader a
  // working door instead (see shelf-empty.tsx).
  const sections: Record<string, ReactNode> = {
    testimonials: <Testimonials reviews={reviews} />,
    howto: <HowToOrder />,
    games: <GameRail products={products} signals={signals} />,
    services: <ServiceRail products={products} art={serviceArt} />,
    packs: <RobuxPacks products={products} />,
    premium: <PremiumPlans />,
    limited: <LimitedRedeem products={products} />,
    featured: <FeaturedListings products={products} sellers={sellers} signals={signals} />,
  };

  return (
    <>
      {/* Admin-authored pop-up (tab Notifikasi). Shows itself once per visitor
          per version — the dismissal lives in localStorage, not a cookie. */}
      {popup.enabled ? <HomePopup popup={popup} /> : null}
      <Hero />
      {visibleSections(layout).map((id) => (
        <div key={id} data-section={id} style={{ display: "contents" }}>
          {sections[id]}
        </div>
      ))}
    </>
  );
}
