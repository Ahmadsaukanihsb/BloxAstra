"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { cx } from "@/lib/cx";
import { AstraMark } from "@/components/ui/icons";
import {
  IconCrown,
  IconChat,
  IconCompass,
  IconHexCoin,
  IconLogout,
  IconPackage,
  IconReceipt,
  IconShieldCheck,
  IconSliders,
  IconStorefront,
  IconWallet,
} from "@/components/ui/icons";

type Role = "buyer" | "seller" | "admin";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

function buildSections(role: Role): NavSection[] {
  const dash: NavItem[] = [];
  if (role === "admin") {
    dash.push({ href: "/dashboard/admin", label: "Super dashboard", icon: IconCrown });
    dash.push({ href: "/admin", label: "Panel admin", icon: IconShieldCheck });
    dash.push({ href: "/dashboard/penjual", label: "Preview penjual", icon: IconStorefront });
  } else if (role === "seller") {
    // Ordered by how often a seller needs them: queue first, admin-ish last.
    dash.push({ href: "/dashboard/penjual", label: "Ringkasan", icon: IconStorefront });
    dash.push({ href: "/dashboard/penjual/pesanan", label: "Pesanan", icon: IconReceipt });
    dash.push({ href: "/dashboard/penjual/listing", label: "Listing & stok", icon: IconPackage });
    dash.push({ href: "/dashboard/penjual/dompet", label: "Dompet & penarikan", icon: IconWallet });
    dash.push({ href: "/dashboard/penjual/order-robux", label: "Order rebutan", icon: IconHexCoin });
    dash.push({ href: "/dashboard/penjual/grup", label: "Grup seller", icon: IconChat });
    dash.push({ href: "/dashboard/penjual/pengaturan", label: "Pengaturan toko", icon: IconSliders });
  }
  // The rail is a seller/admin workspace. Buyer accounts are redirected out of
  // /dashboard, so this shell never renders for them.
  const sections = [
    { title: "Dashboard", items: dash },
    {
      title: "Situs",
      items: [{ href: "/katalog", label: "Lihat katalog", icon: IconCompass }],
    },
  ].filter((section) => section.items.length > 0);

  return sections;
}

/**
 * The most specific href wins. Plain prefix matching would keep "Ringkasan"
 * (`/dashboard/penjual`) highlighted on every one of its sub-routes, so the
 * rail would show two active items at once.
 */
function resolveActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}

const ROLE_LABEL: Record<Role, string> = {
  admin: "admin",
  seller: "penjual",
  buyer: "pembeli",
};

export function DashboardSidebar({ username, role }: { username: string; role: Role }) {
  const pathname = usePathname();
  const sections = buildSections(role);
  const initials = username.slice(0, 2).toUpperCase();
  const flat = sections.flatMap((section) => section.items);
  const activeHref = resolveActiveHref(
    pathname,
    flat.map((item) => item.href),
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-paper lg:flex">
        <Link
          href="/dashboard"
          className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4"
        >
          <span className="text-astra-ink">
            <AstraMark size={24} />
          </span>
          <span className="font-display text-[15px] font-extrabold tracking-tight text-ink">
            Blox<span className="text-astra-ink">Astra</span>
          </span>
          <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink-mute">
            dashboard
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-3 overflow-y-auto p-2.5">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <span className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-ink-mute">
                {section.title}
              </span>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cx(
                      "flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-bold transition-colors duration-200",
                      active
                        ? "bg-astra/[0.08] text-ink outline outline-1 -outline-offset-1 outline-astra/25"
                        : "text-ink-dim outline outline-1 -outline-offset-1 outline-transparent hover:bg-canvas hover:text-ink",
                    )}
                  >
                    <Icon size={17} className={active ? "text-astra-ink" : "text-ink-mute"} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-line p-3">
          <div className="flex items-center gap-2.5 px-2 pb-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-astra/15 text-[11px] font-extrabold text-astra-ink">
              {initials}
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-bold text-ink">{username}</div>
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink-mute">
                {ROLE_LABEL[role]}
              </div>
            </div>
          </div>
          <a
            href="/api/auth/logout"
            className="flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-bold text-danger transition-colors duration-200 hover:bg-danger/[0.07]"
          >
            <IconLogout size={17} />
            Keluar
          </a>
        </div>
      </aside>

      {/* Mobile bar */}
      <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-astra-ink">
              <AstraMark size={22} />
            </span>
            <span className="font-display text-[14px] font-extrabold tracking-tight text-ink">
              Blox<span className="text-astra-ink">Astra</span>
            </span>
            <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-ink-mute">
              dashboard
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-full bg-astra/15 text-[11px] font-extrabold text-astra-ink">
              {initials}
            </span>
            <a
              href="/api/auth/logout"
              aria-label="Keluar"
              className="grid size-9 place-items-center rounded-full text-danger transition-colors duration-200 hover:bg-danger/[0.07]"
            >
              <IconLogout size={18} />
            </a>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3">
          {flat.map((item) => {
            const active = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-200",
                  active
                    ? "bg-astra text-white"
                    : "bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </header>
    </>
  );
}
