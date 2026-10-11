import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Entry choreography powered by CSS scroll-driven animations
 * (`animation-timeline: view()`), defined in globals.css.
 *
 * Why not IntersectionObserver: these are server components, so no hydration
 * cost is paid for decoration — and if a browser lacks support the content
 * renders visible instead of being stuck at opacity 0.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const style = {
    "--reveal-shift": `${y}px`,
    "--reveal-offset": `${(delay * 12).toFixed(1)}%`,
  } as CSSProperties;

  return (
    <div className={cx("reveal", className)} style={style}>
      {children}
    </div>
  );
}

export function RevealGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return <div className={cx("reveal-group", className)}>{children}</div>;
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("reveal-item", className)}>{children}</div>;
}
