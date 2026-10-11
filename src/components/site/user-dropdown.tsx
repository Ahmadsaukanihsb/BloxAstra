"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/lib/cx";
import {
  IconChevronDown,
  IconCrown,
  IconLogout,
  IconPackage,
  IconShieldCheck,
  IconStorefront,
  IconUserSquare,
  IconWallet,
} from "@/components/ui/icons";

export function UserDropdown({
  username,
  role,
}: {
  username: string;
  role: "buyer" | "seller" | "admin";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const baseItems = [
    { href: "/profil", icon: IconUserSquare, label: "Profil Saya" },
    { href: "/dompet", icon: IconWallet, label: "Dompet" },
    { href: "/pesanan", icon: IconPackage, label: "Pesanan Saya" },
  ];

  const roleItems =
    role === "admin"
      ? [
          { href: "/admin", icon: IconShieldCheck, label: "Panel Admin" },
          { href: "/dashboard/admin", icon: IconCrown, label: "Super Dashboard" },
        ]
      : role === "seller"
        ? [{ href: "/dashboard/penjual", icon: IconStorefront, label: "Dashboard Penjual" }]
        : [];

  const items = [...roleItems, ...baseItems];

  return (
    <div ref={ref} className="relative hidden items-center md:flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex h-9 items-center gap-2 rounded-full bg-canvas px-3 text-[13px] text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink",
          open && "bg-astra/[0.07] text-ink outline-astra/25",
        )}
      >
        <span className="grid size-6 place-items-center rounded-full bg-astra/15 text-[10px] font-extrabold text-astra-ink">
          {initials}
        </span>
        <span className="max-w-[8rem] truncate font-bold">{username}</span>
        <IconChevronDown
          size={14}
          className={cx("transition-transform duration-300", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-60 origin-top-right rounded-2xl border border-line bg-paper p-1.5 shadow-[0_18px_44px_-24px_rgba(15,23,42,0.22)]">
          <div className="flex flex-col">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-ink transition-colors duration-300 hover:bg-canvas"
                >
                  <Icon size={16} className="text-ink-dim" />
                  {item.label}
                </Link>
              );
            })}
            <div className="my-1 h-px bg-hairline" />
            <a
              href="/api/auth/logout"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-danger transition-colors duration-300 hover:bg-danger/[0.07]"
            >
              <IconLogout size={16} />
              Keluar
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
