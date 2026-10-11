import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Manrope, Montserrat } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { getCategories } from "@/lib/catalog";
import { getCachedActiveRates } from "@/lib/rate-card";
import { PromoStrip } from "@/components/site/promo-strip";
import { TopNav } from "@/components/site/top-nav";
import { NavGate } from "@/components/site/nav-gate";
import { NavAuth } from "@/components/site/nav-auth";
import { BottomNav } from "@/components/site/bottom-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { RateProvider } from "@/components/rates/rate-store";
import { SiteJsonLd } from "@/components/site/json-ld";
import { SITE_URL } from "@/lib/site";
import type { Category } from "@/lib/types";
import type { ReactNode } from "react";

async function TopNavWithAuth({
  authSlot,
  categories,
}: {
  authSlot?: ReactNode;
  categories: Category[];
}) {
  await connection();
  const user = await getCurrentUser();
  const balance = user ? await getWalletBalance(user.id) : null;
  return (
    <TopNav
      authSlot={authSlot}
      categories={categories}
      isLoggedIn={Boolean(user)}
      userRole={user?.role ?? null}
      balance={balance}
    />
  );
}

/** Marketing strip for prospective sellers — hidden once they already sell. */
async function PromoStripWithAuth() {
  await connection();
  const user = await getCurrentUser();
  if (user?.role === "seller") return null;
  return <PromoStrip />;
}

validateEnv();

// Montserrat carries headings: this is the face Roblox published as the
// replacement for Gotham when they rebuilt their own UI, so the headings read
// Roblox-adjacent without shipping Builder Sans. Real 800 weight keeps the
// existing `font-extrabold` display type intact.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const DESCRIPTION =
  "Top up Robux, gamepass, item in-game, Gift Card, akun, dan Premium Roblox di Blox Astra. Dana ditahan sampai barang diterima, penjual terverifikasi, dan garansi pengembalian dana 100%.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Blox Astra: Top Up Robux & Gamepass Roblox Murah",
    template: "%s · Blox Astra",
  },
  description: DESCRIPTION,
  keywords: [
    "roblox",
    "robux",
    "top up robux",
    "gamepass roblox",
    "marketplace roblox",
    "jual beli item roblox",
    "blox fruits",
    "dana ditahan",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "Blox Astra",
    title: "Blox Astra: Top Up Robux & Gamepass Roblox Murah",
    description: DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Blox Astra: Top Up Robux & Gamepass Roblox Murah",
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [categories, rates] = await Promise.all([getCategories(), getCachedActiveRates()]);
  return (
    <html
      lang="id"
      className={`${montserrat.variable} ${manrope.variable} antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-[100dvh] bg-paper text-ink selection:bg-astra-mint" suppressHydrationWarning>
        <Suspense fallback={null}>
          <SiteJsonLd description={DESCRIPTION} />
        </Suspense>
        <RateProvider initialRates={rates}>
          <Suspense fallback={null}>
            <NavGate>
              <PromoStripWithAuth />
              <TopNavWithAuth authSlot={<NavAuth />} categories={categories} />
            </NavGate>
          </Suspense>
          <main className="relative z-10 pb-28 md:pb-0">{children}</main>
          <Suspense fallback={null}>
            <NavGate>
              <SiteFooter categories={categories} />
            </NavGate>
          </Suspense>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </RateProvider>
      </body>
    </html>
  );
}
