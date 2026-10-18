"use client";

import { AstraMark } from "@/components/ui/icons";

/**
 * The brand mark: custom uploaded logo when the admin set one, otherwise the
 * built-in AstraMark. Mark-only — callers keep their own wordmark text and
 * hover styling, so swapping the logo never restyles the header.
 */
export function BrandMark({
  logo,
  size = 26,
}: {
  /** Custom logo data URL from `getSiteLogo()`, or null for the built-in mark. */
  logo: string | null;
  size?: number;
}) {
  if (logo) {
    // A custom logo reads tiny at mark height, so it gets a larger footprint
    // than the built-in mark — capped to fit the header/rail bars. The bar
    // itself never grows, so nothing below it jumps.
    const height = Math.min(Math.round(size * 1.6), 44);
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt="Blox Astra"
        className="rounded-control object-contain"
        style={{ height, width: "auto", maxWidth: 168 }}
      />
    );
  }
  return <AstraMark size={size} />;
}
