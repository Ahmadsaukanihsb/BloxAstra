import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Manrope, Montserrat } from "next/font/google";
import "./globals.css";
import { validateEnv } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getWalletBalance } from "@/lib/wallet";
import { getSellerChatUnreadCount } from "@/lib/seller";
import { getOrderUnreadTotal } from "@/lib/orders";
import { getCategories } from "@/lib/catalog";
import { getCachedActiveRates } from "@/lib/rate-card";
import { getSiteLogo } from "@/lib/site-logo";
import { getSitePromo } from "@/lib/site-notice";
import { PromoStrip } from "@/components/site/promo-strip";
import { TopNav } from "@/components/site/top-nav";
import { NavGate } from "@/components/site/nav-gate";
import { NavAuth } from "@/components/site/nav-auth";
import { BottomNav } from "@/components/site/bottom-nav";
import { SiteFooter } from "@/components/site/site-footer";
import { LiveToaster } from "@/components/site/live-toaster";
import { LiveSound } from "@/components/site/live-sound";
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
  const [balance, logo, orderUnread] = await Promise.all([
    user ? getWalletBalance(user.id) : Promise.resolve(null),
    getSiteLogo(),
    user ? getOrderUnreadTotal(user.id, user.role) : Promise.resolve(0),
  ]);
  return (
    <TopNav
      authSlot={authSlot}
      categories={categories}
      isLoggedIn={Boolean(user)}
      userRole={user?.role ?? null}
      balance={balance}
      logo={logo}
      orderUnread={orderUnread}
    />
  );
}

/**
 * The bottom bar is public, but sellers get one extra tab in it — the group
 * room, with its unread count. The role and the count are read here so the bar
 * arrives complete instead of growing a tab a moment after the first paint.
 */
async function BottomNavWithAuth() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return <BottomNav />;
  const [groupUnread, orderUnread] = await Promise.all([
    user.role === "seller" ? getSellerChatUnreadCount(user.id) : Promise.resolve(0),
    getOrderUnreadTotal(user.id, user.role),
  ]);
  return <BottomNav role={user.role} groupUnread={groupUnread} orderUnread={orderUnread} />;
}

/**
 * Marketing strip for prospective sellers — hidden once they already sell,
 * and hidden for everyone when the admin turns it off in /admin → Notifikasi.
 */
async function PromoStripWithAuth() {
  await connection();
  const [user, promo] = await Promise.all([getCurrentUser(), getSitePromo()]);
  if (user?.role === "seller") return null;
  if (!promo.enabled) return null;
  return <PromoStrip message={promo.message} ctaLabel={promo.ctaLabel} ctaHref={promo.ctaHref} />;
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
  "Top up Robux, gamepass, item, dan Premium Roblox di Blox Astra. Dana ditahan sampai barang diterima, penjual terverifikasi, garansi dana kembali 100%.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Blox Astra: Top Up Robux & Gamepass Roblox Murah",
    template: "%s · Blox Astra",
  },
  description: DESCRIPTION,
  icons: { icon: "/api/favicon" },
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
  // Matches `--color-canvas`. This tints the browser's own chrome on mobile, so
  // a white value here puts a white bar above a near-black lobby — the app
  // declares `color-scheme: dark` and has no light theme to fall back to.
  themeColor: "#0d0d11",
  width: "device-width",
  initialScale: 1,
};

/**
 * Live toasts are for signed-in visitors only; signed-out pages skip the
 * stream entirely. The toaster itself renders nothing until a fresh
 * notification arrives, so it never blocks paint.
 */
async function LiveToasterWithAuth() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <>
      <LiveToaster />
      <LiveSound />
    </>
  );
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [categories, rates] = await Promise.all([getCategories(), getCachedActiveRates()]);
  return (
    <html
      lang="id"
      className={`${montserrat.variable} ${manrope.variable} antialiased`}
      suppressHydrationWarning
    >
      {/* `bg-canvas` is the floor. Panels inside pages use `bg-paper` and are
          therefore lighter than the page, which is what gives them depth. */}
      <body className="min-h-[100dvh] bg-canvas text-ink" suppressHydrationWarning>
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
              <SiteFooter />
            </NavGate>
          </Suspense>
          <Suspense fallback={null}>
            <BottomNavWithAuth />
          </Suspense>
          <Suspense fallback={null}>
            <LiveToasterWithAuth />
          </Suspense>
        </RateProvider>
      </body>
    </html>
  );
}
