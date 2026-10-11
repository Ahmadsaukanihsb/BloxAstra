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
          "bezel-core rounded-3xl outline outline-1 -outline-offset-1 outline-line",
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

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  action,
}: {
  eyebrow?: string;
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
      <div className="flex max-w-2xl flex-col gap-3">
        {eyebrow ? (
          <span className="flex w-fit items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-astra-ink">
            <span aria-hidden className="h-0.5 w-4 rounded-full bg-current" />
            {eyebrow}
          </span>
        ) : null}
        <h2 className="text-[1.6rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink md:text-[2rem]">
          {title}
        </h2>
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
  return <div className={cx("h-px w-full bg-hairline", className)} />;
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
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-b-0">
      <span className="text-xs text-ink-mute">{label}</span>
      <span className={cx("num text-sm font-bold", toneClass)}>{value}</span>
    </div>
  );
}
