import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { SectionHeading } from "@/components/ui/surface";
import { cx } from "@/lib/cx";
import { landingSignalLabels } from "@/lib/landing-signals";
import type { LandingSignals } from "@/lib/types";
import { IconArrowRight, IconArrowUpRight, IconCheckCircle } from "@/components/ui/icons";

/**
 * The home page is assembled from the live catalog, so any shelf can come up
 * empty — and an empty shelf used to simply vanish, which turns a quiet day
 * into a home page that looks broken. These blocks are what a shelf shows
 * instead: it keeps the section's heading and its place in the page's rhythm,
 * states plainly why it is bare, and points at the nearest thing that still
 * works. Two rules hold everywhere here:
 *
 *   1. No invented inventory. Nothing pretends to be a listing or a pack.
 *   2. Keep it lighter than a full shelf. Five apologetic cards would shout
 *      louder than the shelves they replaced; a hairline row is a status line,
 *      not a section.
 *
 * The one piece of pressure that is honest: the direct top-up flows (username,
 * login, gamepass, premium) are sold by the platform and keep working with an
 * empty catalog, so the shelves that map onto one of those say so first.
 */

/** Buy-flow or destination link shown in a section heading. */
export interface EmptyAction {
  href: string;
  label: string;
  /** `primary` where a platform flow is being offered, `secondary` for a browse door. */
  variant?: "primary" | "secondary";
}

/** Proof chips — which counts earn a line is decided in landing-signals.ts. */
export function SignalChips({ signals }: { signals?: LandingSignals }) {
  if (!signals) return null;
  const signalsText = landingSignalLabels(signals);
  if (!signalsText.length) return null;

  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {signalsText.map((text) => (
        <span key={text} className="flex items-center gap-1.5 text-[11px] font-bold text-ink-dim">
          <IconCheckCircle size={13} className="shrink-0 text-success" />
          {text}
        </span>
      ))}
    </span>
  );
}

/**
 * One bare shelf: an icon, the shelf's own name, and what a visitor can do
 * about it right now. Icon and copy are the section's, so five empty shelves
 * never read as one template stamped five times.
 */
export function EmptyRow({
  label,
  body,
  icon,
  signals,
  secondary,
  className,
}: {
  /** the shelf's own name, e.g. "Rak per game" */
  label: string;
  /** one sentence: why it is empty, and what still works */
  body: string;
  icon: ReactNode;
  signals?: LandingSignals;
  secondary?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-card border border-dashed border-line bg-paper/70 px-4 py-3.5 md:px-5",
        className,
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-canvas-2 text-ink-mute">
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[12px] font-extrabold text-ink">{label}</span>
          <span className="max-w-[70ch] text-[11.5px] leading-relaxed text-ink-dim">{body}</span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
        <SignalChips signals={signals} />
        {secondary ? (
          <Link
            href={secondary.href}
            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-astra-ink transition-colors duration-300 hover:text-ink"
          >
            {secondary.label}
            <IconArrowUpRight size={13} />
          </Link>
        ) : null}
      </span>
    </div>
  );
}

/**
 * A whole section in its bare state: the shelf's own heading, an honest line
 * about why there is nothing in it, and one live door out. Used by the sections
 * that own a single heading; shelves sharing a heading use `EmptyRow` directly.
 */
export function ShelfEmpty({
  title,
  description,
  action,
  label,
  body,
  icon,
  signals,
  secondary,
}: {
  title: ReactNode;
  description: string;
  action?: EmptyAction;
  label: string;
  body: string;
  icon: ReactNode;
  signals?: LandingSignals;
  secondary?: { href: string; label: string };
}) {
  return (
    <section className="px-4 py-12 md:px-8 md:py-14">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-6">
        <Reveal>
          <SectionHeading
            align="between"
            title={title}
            description={description}
            action={
              action ? (
                <ButtonLink
                  href={action.href}
                  variant={action.variant ?? "secondary"}
                  trailingIcon={<IconArrowRight size={16} />}
                  iconCircleClassName={action.variant === "primary" ? undefined : "bg-canvas"}
                >
                  {action.label}
                </ButtonLink>
              ) : null
            }
          />
        </Reveal>

        <Reveal delay={0.05}>
          <EmptyRow label={label} body={body} icon={icon} signals={signals} secondary={secondary} />
        </Reveal>
      </div>
    </section>
  );
}
