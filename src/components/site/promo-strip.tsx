import Link from "next/link";
import { IconArrowRight, RobuxGlyph } from "@/components/ui/icons";

/**
 * Top announcement strip — soft mint gradient, one line, one link.
 * Kept as a server component: no state, no motion, no layout shift.
 */
export function PromoStrip() {
  return (
    <div className="accent-wash relative z-30">
      <div className="mx-auto flex max-w-[1180px] items-center justify-center gap-2.5 px-4 py-2">
        <RobuxGlyph size={14} className="shrink-0 text-astra-deep" />
        <p className="truncate text-[12px] font-bold text-astra-deep">
          <span className="hidden sm:inline">
            Bonus seller baru untuk orderan pertama. Dana ditahan platform, garansi pengembalian dana 100%
          </span>
          <span className="sm:hidden">
            Bonus seller baru
          </span>
        </p>
        <Link
          href="/daftar"
          className="group flex shrink-0 items-center gap-1 rounded-full bg-paper/80 px-2.5 py-0.5 text-[11px] font-extrabold text-astra-deep transition-colors duration-300 hover:bg-paper"
        >
          Klaim
          <IconArrowRight
            size={12}
            className="transition-transform duration-300 ease-[var(--ease-astra)] group-hover:translate-x-0.5"
          />
        </Link>
      </div>
    </div>
  );
}
