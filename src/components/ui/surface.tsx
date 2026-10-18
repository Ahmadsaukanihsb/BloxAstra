import type { ElementType, ReactNode } from "react";
import { cx } from "@/lib/cx";

interface SurfaceProps {
  children: ReactNode;
  className?: string;
  /** inner core background override */
  coreClassName?: string;
  as?: ElementType;
  /** removes the outer tray, keeping only the hairline core */
  flush?: boolean;
}

/**
 * Double-bezel container: an outer machined tray holding a concentric inner core.
 * Used for every elevated block in the product so depth is consistent.
 */
export function Surface({
  children,
  className,
  coreClassName,
  as: Tag = "div",
  flush = false,
}: SurfaceProps) {
  if (flush) {
    return (
      <Tag
        className={cx(
          "bezel-core rounded-card outline outline-1 -outline-offset-1 outline-line",
          coreClassName,
          className,
        )}
      >
        {children}
      </Tag>
    );
  }

  return (
    <Tag className={cx("bezel-shell p-1.5", className)}>
      <div className={cx("bezel-core h-full", coreClassName)}>{children}</div>
    </Tag>
  );
}

/**
 * Shelf header. There is deliberately no eyebrow label above the title: a
 * tracked-out small-caps marker above every heading is the single most common
 * generated-page tell, and on a storefront it told the reader nothing the
 * title did not. The title states the shelf; the description explains it.
 */
export function SectionHeading({
  title,
  description,
  align = "left",
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "between";
  action?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-5",
        align === "between" && "md:flex-row md:items-end md:justify-between",
      )}
    >
      <div className="flex max-w-2xl flex-col gap-2.5">
        <h2 className="text-title font-extrabold text-ink">{title}</h2>
        {description ? (
          <p className="max-w-[58ch] text-[13px] leading-relaxed text-ink-dim md:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Hairline({ className }: { className?: string }) {
  return <div className={cx("h-px w-full bg-line", className)} />;
}

export function StatRow({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "astra" | "robux" | "danger" | "warn";
}) {
  const toneClass = {
    default: "text-ink",
    astra: "text-astra-ink",
    robux: "text-robux",
    danger: "text-danger",
    warn: "text-warn",
  }[tone];

  return (
    // Label sits above its value: in a multi-column grid a label-left/value-right
    // row pushes every value next to the following label, so the pairs stop reading.
    <div className="flex flex-col gap-0.5 py-1">
      <span className="text-xs text-ink-mute">{label}</span>
      <span className={cx("num text-sm font-bold", toneClass)}>{value}</span>
    </div>
  );
}
