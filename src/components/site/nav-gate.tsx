"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

const HIDDEN_PREFIXES = ["/dashboard", "/admin"];

/**
 * Hides the site chrome (top navigation + hamburger overlay, promo strip, and
 * the marketing footer) while the visitor is inside a dashboard. `usePathname`
 * is also populated during SSR, so the server HTML already matches — no flash
 * of nav on dashboard routes.
 */
export function NavGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hidden = HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (hidden) return null;
  return <>{children}</>;
}
