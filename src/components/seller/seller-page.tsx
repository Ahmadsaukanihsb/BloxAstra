import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Editorial building blocks for the seller area.
 *
 * The seller dashboard is a workspace for someone handling money, so the type
 * scale runs larger than the storefront's: one heavy display line per page, a
 * wide-tracked eyebrow above it, and a lede capped near 62 characters. Crimson
 * is reserved for state and the primary action — never used as decoration.
 */

export function SellerPageHeader({
  eyebrow,
  title,
  lede,
  actions,
  meta,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-7 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between md:gap-10">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-ink-mute">
            {eyebrow}
          </span>
          {meta}
        </div>
        <h1 className="font-display text-[2.1rem] font-extrabold leading-[1.04] tracking-[-0.035em] text-ink md:text-[3rem]">
          {title}
        </h1>
        {lede ? (
          <p className="max-w-[62ch] text-[13.5px] leading-[1.75] text-ink-dim md:text-sm">
            {lede}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * The one card shape used across every seller page. Keeps the whole area
 * reading as a single document instead of a pile of differently-styled boxes.
 */
export function SellerSection({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cx("bezel-shell p-1.5", className)}>
      <div className={cx("bezel-core flex flex-col gap-5 p-5 md:p-6", bodyClassName)}>
        {title || action ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              {title ? (
                <h2 className="font-display text-[15px] font-extrabold tracking-[-0.01em] text-ink">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p className="max-w-[58ch] text-[12px] leading-relaxed text-ink-mute">
                  {description}
                </p>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}

/** Asymmetric two-column workspace: content left, rail right. */
export function SellerGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {children}
    </div>
  );
}

/** Vertical stack that gives every block the same breathing room. */
export function SellerStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 md:gap-6">{children}</div>;
}
