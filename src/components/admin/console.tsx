import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * Shared chrome for every admin surface.
 *
 * This file has no "use client" on purpose: the panel (a client component) and
 * the search / super-dashboard pages (server components) all draw from the same
 * primitives, so the console keeps one voice without duplicating markup. Keep
 * browser-only APIs out of here.
 */

type Tone = "astra" | "danger" | "warn" | "robux" | "success" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  astra: "text-astra-ink",
  danger: "text-danger",
  warn: "text-warn",
  robux: "text-robux",
  success: "text-success",
  neutral: "text-ink",
};

const TONE_RAIL: Record<Tone, string> = {
  astra: "bg-astra/70",
  danger: "bg-danger/70",
  warn: "bg-warn/70",
  robux: "bg-robux/70",
  success: "bg-success/70",
  neutral: "bg-line-strong",
};

/**
 * The desk header. Says who is on duty, what this surface is for, and keeps
 * action buttons at the same height.
 *
 * `dense` collapses it to a single row for surface pages that already have
 * plenty of chrome around them (the admin panel's own tab desk): eyebrow and
 * title inline, description dropped, actions to the right.
 */
export function ConsoleMasthead({
  eyebrow,
  title,
  description,
  meta,
  actions,
  dense = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  dense?: boolean;
}) {
  if (dense) {
    return (
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-line pb-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="eyebrow text-ink-mute">{eyebrow}</span>
          <h1 className="font-display text-title font-extrabold text-ink">{title}</h1>
          {meta}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 flex-col gap-2.5">
        <span className="flex items-center gap-2 eyebrow text-ink-mute">
          <span aria-hidden className="size-1.5 rounded-full bg-astra" />
          {eyebrow}
        </span>
        <h1 className="font-display text-page font-extrabold text-ink">{title}</h1>
        {description ? (
          <p className="max-w-[70ch] text-[13px] leading-relaxed text-ink-dim">{description}</p>
        ) : null}
        {meta ? <div className="flex flex-wrap items-center gap-2.5 pt-1">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * One figure in the console band. Renders a link when `href` is given and a
 * button when `onClick` is — so the same tile can jump to a tab inside the
 * panel or to a route elsewhere, and stays a plain block when it is only a
 * number to read.
 */
export function KpiTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  onClick,
  active,
  dense = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  dense?: boolean;
}) {
  const interactive = Boolean(href || onClick);
  const className = cx(
    "bezel-shell group flex flex-col justify-between text-left",
    dense ? "min-h-[84px] gap-1.5 p-3" : "min-h-[108px] gap-2.5 p-4",
    interactive &&
      "transition-[transform,background-color,outline-color] duration-300 ease-[var(--ease-astra)] hover:-translate-y-0.5 hover:bg-paper/70 hover:outline-line-strong",
    active ? "outline-2 -outline-offset-2 outline-astra/70" : "",
  );

  const body = (
    <>
      <span className="eyebrow text-ink-mute">{label}</span>
      <span className="flex items-end justify-between gap-2">
        <span className={cx("price leading-none", dense ? "text-[19px]" : "text-[26px]", TONE_TEXT[tone])}>
          {value}
        </span>
        {interactive ? (
          <span
            aria-hidden
            className="text-[13px] font-bold text-ink-mute transition-transform duration-300 group-hover:translate-x-0.5"
          >
            →
          </span>
        ) : null}
      </span>
      {hint ? (
        <span className={cx("leading-snug text-ink-mute", dense ? "text-[10px]" : "text-[11px]")}>
          {hint}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-current={active ? "true" : undefined} className={className}>
        {body}
      </button>
    );
  }
  return <div className={className}>{body}</div>;
}

/** A titled block inside the console: heading, honest hint, and one action door. */
export function PanelSection({
  title,
  hint,
  description,
  action,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-title font-extrabold text-ink">{title}</h2>
            {hint ? <span className="num text-[11px] text-ink-mute">{hint}</span> : null}
          </div>
          {description ? (
            <p className="max-w-[72ch] text-[12px] leading-relaxed text-ink-dim">{description}</p>
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2.5">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** A framed record card. The tinted rail marks the ones that need a decision. */
export function RecordFrame({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <article className={cx("bezel-shell relative overflow-hidden p-1.5", className)}>
      {tone ? (
        <span
          aria-hidden
          className={cx("absolute inset-y-2 left-2 w-[3px] rounded-full", TONE_RAIL[tone])}
        />
      ) : null}
      <div className="bezel-core flex flex-col gap-4 p-4 md:p-5">{children}</div>
    </article>
  );
}

/**
 * Rows of one list inside a single frame, separated by hairlines instead of a
 * card each — a queue should read as one table of work, not as a pile of boxes.
 */
export function ListFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("bezel-shell p-1.5", className)}>
      <div className="bezel-core divide-y divide-line overflow-hidden">{children}</div>
    </div>
  );
}

/** A key/value line for record footers. Numbers keep the mono voice. */
export function DataRow({
  label,
  value,
  tone = "neutral",
  mono = true,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-ink-mute">{label}</span>
      <span className={cx("text-right text-[12px]", mono && "num", TONE_TEXT[tone])}>{value}</span>
    </div>
  );
}
