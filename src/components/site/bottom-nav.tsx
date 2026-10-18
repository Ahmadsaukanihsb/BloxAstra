"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cx } from "@/lib/cx";
import { useGroupChatUnread } from "@/lib/chat-unread";
import {
  IconChat,
  IconCompass,
  IconHome,
  IconReceipt,
  IconStorefront,
  IconWallet,
} from "@/components/ui/icons";

interface Tab {
  href: string;
  label: string;
  icon: typeof IconHome;
}

const BASE_TABS: Tab[] = [
  { href: "/", label: "Beranda", icon: IconHome },
  { href: "/katalog", label: "Jelajah", icon: IconCompass },
  { href: "/katalog?kategori=item", label: "Item", icon: IconStorefront },
  { href: "/pesanan", label: "Pesanan", icon: IconReceipt },
  { href: "/dompet", label: "Dompet", icon: IconWallet },
];

/** The seller group room is the one tab only sellers have any business in. */
const GROUP_TAB: Tab = { href: "/dashboard/penjual/grup", label: "Grup", icon: IconChat };

export function BottomNav({
  role = null,
  groupUnread = 0,
}: {
  role?: "buyer" | "seller" | "admin" | null;
  /** Unread group messages, read on the server so the tab is never a surprise. */
  groupUnread?: number;
}) {
  const pathname = usePathname();
  const isSeller = role === "seller";
  const unread = useGroupChatUnread(groupUnread, isSeller);

  const tabs: Tab[] = isSeller
    ? [...BASE_TABS.slice(0, 4), GROUP_TAB, BASE_TABS[4]]
    : BASE_TABS;

  // One tab lights up at a time: the first matching entry wins, so the
  // category shortcut `/katalog?kategori=item` never shadows `/katalog`.
  const activeIndex = (() => {
    if (pathname === "/") return 0;
    for (let index = 0; index < tabs.length; index += 1) {
      const base = tabs[index].href.split("?")[0];
      if (base !== "/" && (pathname === base || pathname.startsWith(`${base}/`))) return index;
    }
    return -1;
  })();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 md:hidden">
      <div className="flex w-full max-w-md items-stretch gap-0.5 rounded-card bg-paper/95 p-1.5 shadow-[0_-1px_2px_rgba(16,24,40,0.05),0_-14px_34px_-20px_rgba(16,24,40,0.22)] outline outline-1 -outline-offset-1 outline-line backdrop-blur-2xl">
        {tabs.map((tab, index) => {
          const active = index === activeIndex;
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cx(
                "relative isolate flex flex-1 flex-col items-center gap-1 rounded-card px-1 py-2.5 transition-colors duration-300",
                active ? "text-astra-ink" : "text-ink-mute",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="bottom-tab"
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className="absolute inset-0 -z-10 rounded-card bg-astra/[0.1] outline outline-1 -outline-offset-1 outline-astra/20"
                />
              ) : null}
              <span className="relative">
                <Icon size={20} />
                {tab.href === GROUP_TAB.href && unread > 0 ? (
                  <span
                    aria-label={`${unread} pesan grup belum dibaca`}
                    className="num absolute -right-2.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-astra px-1 text-[9px] font-extrabold text-on-bright"
                  >
                    {unread > 99 ? "99+" : unread}
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-bold tracking-tight">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
