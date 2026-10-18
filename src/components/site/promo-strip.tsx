import Link from "next/link";
import { RobuxGlyph } from "@/components/ui/icons";

/**
 * Announcement rail. A solid red band with a dark chip, not a pastel gradient:
 * on the dark theme a tinted wash put dark red text on a dark red ground and
 * the line became unreadable. White on the brand red measures 4.68:1, which is
 * legal for a 12px bold label.
 *
 * Copy and link come from the admin panel (`/admin` → Notifikasi) and are read
 * through `getSitePromo()`; hiding the strip is the same toggle. Kept as a
 * server component: no state, no motion, no layout shift.
 */
export function PromoStrip({
  message,
  ctaLabel,
  ctaHref,
}: {
  message: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="relative z-30 bg-astra">
      <div className="mx-auto flex max-w-[1180px] items-center justify-center gap-3 px-4 py-2">
        <RobuxGlyph size={14} className="shrink-0 text-white" />
        <p className="truncate text-[12px] font-bold text-white">{message}</p>
        <Link
          href={ctaHref}
          className="shrink-0 rounded-tag bg-canvas-2 px-2.5 py-1 tag text-ink transition-transform duration-200 ease-[var(--ease-astra)] hover:-translate-y-px active:translate-y-px"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}
