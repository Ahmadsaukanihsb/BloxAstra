"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { blogUrl } from "@/lib/site";
import { formatIDR } from "@/lib/format";
import { useOrderUnread } from "@/lib/order-unread";
import type { Category } from "@/lib/types";
import { NotifBell } from "@/components/site/notif-bell";
import { SoundToggle } from "@/components/site/live-sound";
import { BrandMark } from "@/components/site/brand-mark";
import {
  RobuxGlyph,
  IconAlert,
  IconArrowRight,
  IconChevronDown,
  IconCrown,
  IconGift,
  IconHexCoin,
  IconLogout,
  IconMenu,
  IconPackage,
  IconSearch,
  IconStorefront,
  IconUserSquare,
  IconX,
} from "@/components/ui/icons";

const CATEGORY_ICON = {
  gamepass: IconHexCoin,
  item: IconPackage,
  gift: IconGift,
  akun: IconUserSquare,
  premium: IconCrown,
} as const;

/**
 * Categories that have a dedicated purchase flow sell through that flow rather
 * than the browse-only catalog, so the shortcut points straight at the order
 * page. Anything missing here falls back to `/katalog?kategori=<slug>`.
 */
const CATEGORY_HREF: Partial<Record<string, string>> = {
  gamepass: "/beli/robux-gamepass",
  premium: "/beli/premium",
};

const primaryLinks = [
  { href: "/katalog", label: "Jelajah" },
                { href: blogUrl("/"), label: "Blog" },
  { href: "/pesanan", label: "Pesanan" },
];

const spring = { type: "spring" as const, stiffness: 220, damping: 26 };

export function TopNav({
  authSlot,
  categories,
  isLoggedIn,
  userRole,
  balance,
  logo,
  orderUnread = 0,
}: {
  authSlot?: ReactNode;
  categories: Category[];
  isLoggedIn?: boolean;
  userRole?: "buyer" | "seller" | "admin" | null;
  balance?: number | null;
  /** Custom logo data URL (null = built-in mark), read server-side in layout. */
  logo?: string | null;
  /** Unread order-chat messages, read server-side so the badge never pops in. */
  orderUnread?: number;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const pendingOrders = useOrderUnread(orderUnread, Boolean(isLoggedIn));

  function closeMenus() {
    setMenuOpen(false);
    setMegaOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur-xl">
        <nav className="mx-auto flex h-16 w-full max-w-[1180px] items-center gap-2 px-3 md:px-6">
          <Link
            href="/"
            onClick={closeMenus}
            className="group flex items-center gap-2.5 pr-1"
          >
            <span className="text-astra-ink">
              <BrandMark logo={logo ?? null} size={26} />
            </span>
            {/* A custom logo is complete on its own; the text only backs the built-in mark. */}
            {!logo ? (
              <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
                Blox<span className="text-astra-ink">Astra</span>
              </span>
            ) : null}
          </Link>

          <form
            action="/katalog"
            role="search"
            className="relative ml-1 flex min-w-0 flex-1 items-center sm:max-w-[300px]"
          >
            <IconSearch size={16} className="pointer-events-none absolute left-3 text-ink-mute" />
            <input
              type="search"
              name="q"
              placeholder="Cari Robux atau item"
              aria-label="Cari listing"
              className="h-9 w-full rounded-full bg-canvas pl-9 pr-9 text-[13px] text-ink outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 placeholder:text-ink-mute focus:bg-paper focus:outline-2 focus:-outline-offset-2 focus:outline-astra/70"
            />
            <button
              type="submit"
              aria-label="Cari"
              className="absolute right-1 grid size-7 place-items-center rounded-full bg-astra text-white transition-colors duration-300 hover:bg-astra-bright"
            >
              <IconArrowRight size={14} />
            </button>
          </form>

          <div className="mx-1 hidden h-6 w-px bg-line lg:block" />

          <div className="hidden items-center gap-0.5 lg:flex">
            <div
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button
                type="button"
                aria-expanded={megaOpen}
                onClick={() => setMegaOpen((open) => !open)}
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-bold text-ink-dim transition-colors duration-300 hover:bg-canvas hover:text-ink"
              >
                Kategori
                <IconChevronDown
                  size={14}
                  className={cx(
                    "transition-transform duration-300 ease-[var(--ease-astra)]",
                    megaOpen && "rotate-180",
                  )}
                />
              </button>

              <AnimatePresence>
                {megaOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.99 }}
                    transition={spring}
                    className="absolute left-0 top-[calc(100%+0.5rem)] w-[34rem] origin-top-left rounded-card border border-line bg-paper p-2 shadow-[0_18px_44px_-24px_rgba(23,21,46,0.22)]"
                  >
                    <div className="grid grid-cols-2 gap-1">
                      {categories.map((category) => {
                        const Icon = CATEGORY_ICON[category.slug] ?? IconPackage;
                        return (
                          <Link
                            key={category.slug}
                            onClick={closeMenus}
                            href={
                              CATEGORY_HREF[category.slug] ?? `/katalog?kategori=${category.slug}`
                            }
                            className="group/item flex items-start gap-3 rounded-well p-3 transition-colors duration-300 hover:bg-canvas"
                          >
                            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-control bg-canvas text-ink-dim transition-colors duration-300 group-hover/item:bg-astra/15 group-hover/item:text-astra-ink">
                              <Icon size={18} />
                            </span>
                            <span className="flex flex-col gap-0.5">
                              <span className="text-[13px] font-bold text-ink">
                                {category.name}
                              </span>
                              <span className="text-[11px] leading-snug text-ink-mute">
                                {category.fulfillment}
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <Link
                      href="/katalog"
                      onClick={closeMenus}
                      className="mt-1 flex items-center justify-between rounded-well bg-astra/[0.07] px-4 py-3 text-[13px] font-bold text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20 transition-colors duration-300 hover:bg-astra/[0.12]"
                    >
                      Lihat semua listing aktif
                      <IconArrowRight size={16} />
                    </Link>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {primaryLinks.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMenus}
                  className={cx(
                    "relative isolate rounded-full px-3 py-2 text-[13px] font-bold transition-colors duration-300",
                    active ? "text-ink" : "text-ink-dim hover:bg-canvas hover:text-ink",
                  )}
                >
                  {link.label}
                  {link.href === "/pesanan" && pendingOrders > 0 ? (
                    <span
                      aria-label={`${pendingOrders} pesan pesanan belum dibaca`}
                      className="num absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-astra px-1 text-[9px] font-extrabold text-on-bright"
                    >
                      {pendingOrders > 99 ? "99+" : pendingOrders}
                    </span>
                  ) : null}
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      transition={spring}
                      className="absolute inset-0 -z-10 rounded-full bg-canvas"
                    />
                  ) : null}
                </Link>
              );
            })}

            {userRole === "admin" ? (
              <Link
                href="/admin"
                onClick={closeMenus}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-[13px] font-bold text-ink-dim transition-colors duration-300 hover:bg-canvas hover:text-ink lg:flex"
              >
                <IconCrown size={16} />
                Panel Admin
              </Link>
            ) : userRole === "seller" ? (
              <Link
                href="/dashboard/penjual"
                onClick={closeMenus}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-[13px] font-bold text-ink-dim transition-colors duration-300 hover:bg-canvas hover:text-ink lg:flex"
              >
                <IconStorefront size={16} />
                Dashboard Penjual
              </Link>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {isLoggedIn && balance !== null && balance !== undefined ? (
              <Link
                href="/dompet"
                onClick={closeMenus}
                title="Saldo akun, buka dompet"
                className="num flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-astra/[0.07] px-3 text-[12px] font-extrabold text-astra-ink outline outline-1 -outline-offset-1 outline-astra/20 transition-colors duration-300 hover:bg-astra/[0.12]"
              >
                <IconHexCoin size={14} />
                {formatIDR(balance)}
              </Link>
            ) : null}
            {isLoggedIn ? <SoundToggle /> : null}
          {isLoggedIn ? <NotifBell /> : null}

            {authSlot ?? (
              <Link
                href="/masuk"
                className="hidden h-9 items-center gap-1.5 rounded-full bg-astra px-4 text-[13px] font-extrabold text-white transition-[transform,translate,scale,rotate,background-color] duration-300 ease-[var(--ease-astra)] hover:bg-astra-bright active:scale-[0.97] md:flex"
              >
                <RobuxGlyph size={15} />
                Masuk
              </Link>
            )}

            <button
              type="button"
              aria-label="Buka menu"
              onClick={() => setMenuOpen(true)}
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink transition-colors duration-300 hover:bg-canvas lg:hidden"
            >
              <IconMenu size={20} />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-50 flex flex-col bg-paper/98 backdrop-blur-3xl lg:hidden"
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="flex items-center gap-2.5 text-astra-ink">
                <BrandMark logo={logo ?? null} size={26} />
                {!logo ? (
                  <span className="font-display text-[15px] font-extrabold text-ink">
                    Blox<span className="text-astra-ink">Astra</span>
                  </span>
                ) : null}
              </span>
              <button
                type="button"
                aria-label="Tutup menu"
                onClick={() => setMenuOpen(false)}
                className="grid size-10 place-items-center rounded-full bg-canvas text-ink"
              >
                <IconX size={20} />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-1 px-4 pt-10">
              {[
                { href: "/katalog", label: "Jelajah Katalog" },
                { href: blogUrl("/"), label: "Blog" },
                { href: "/pesanan", label: "Pesanan Saya" },
                ...(isLoggedIn
                  ? [
                      ...(userRole === "admin"
                        ? [{ href: "/admin", label: "Panel Admin" }]
                        : []),
                      { href: "/notifikasi", label: "Notifikasi" },
                      { href: "/dompet", label: "Saldo Akun" },
                      { href: "/profil", label: "Profil Saya" },
                      ...(userRole === "seller"
                        ? [
                            { href: "/dashboard/penjual", label: "Dashboard Penjual" },
                            { href: "/dashboard/penjual/order-robux", label: "Order Robux" },
                            { href: "/dashboard/penjual/grup", label: "Grup Seller" },
                          ]
                        : []),
                      ...(userRole === "admin"
                        ? [{ href: "/admin", label: "Panel Admin" }]
                        : []),
                    ]
                  : []),
              ].map((item, index) => (
                <motion.div
                  key={item.href}
                  initial={{ opacity: 0, y: 22 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + index * 0.055, ...spring }}
                >
                  <Link
                    href={item.href}
                    onClick={closeMenus}
                    className="flex items-center justify-between border-b border-line py-4 font-display text-2xl font-bold text-ink"
                  >
                    <span className="flex items-center gap-3">
                      {item.label}
                      {item.href === "/pesanan" && pendingOrders > 0 ? (
                        <span className="num rounded-full bg-astra px-2.5 py-0.5 text-[12px] font-extrabold text-on-bright">
                          {pendingOrders > 99 ? "99+" : pendingOrders}
                        </span>
                      ) : null}
                    </span>
                    <IconArrowRight size={20} className="text-ink-mute" />
                  </Link>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ...spring }}
                className="mt-8 flex flex-col gap-3"
              >
                {isLoggedIn ? (
                  <a
                    href="/api/auth/logout"
                    onClick={closeMenus}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-canvas font-extrabold text-ink outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:bg-danger/10 hover:text-danger"
                  >
                    <IconLogout size={18} />
                    Keluar dari akun
                  </a>
                ) : (
                  <Link
                    href="/masuk"
                    onClick={closeMenus}
                    className="flex h-12 items-center justify-center rounded-full bg-astra font-extrabold text-white"
                  >
                    Masuk ke akun
                  </Link>
                )}
                <div className="flex items-start gap-2.5 rounded-well bg-warn/[0.07] p-4 outline outline-1 -outline-offset-1 outline-warn/20">
                  <IconAlert size={16} className="mt-0.5 shrink-0 text-warn" />
                  <p className="text-[11px] leading-relaxed text-ink-dim">
                    Jangan pernah bertransaksi Roblox lewat transfer langsung. Semua pembayaran
                    harus lewat penahanan dana Blox Astra.
                  </p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
