import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type Tone = "neutral" | "astra" | "robux" | "info" | "danger" | "warn" | "muted" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-ink-dim outline-line",
  astra: "bg-astra/10 text-astra-ink outline-astra/25",
  robux: "bg-robux/10 text-robux outline-robux/25",
  info: "bg-info/10 text-info outline-info/25",
  danger: "bg-danger/10 text-danger outline-danger/25",
  warn: "bg-warn/10 text-warn outline-warn/25",
  muted: "bg-transparent text-ink-mute outline-line",
  success: "bg-success/10 text-success outline-success/25",
};

// Labels are angular chips, not pills. A pill is the default shape for a
// generated badge and it also collides with the two shapes that DO mean
// something here (controls and the round avatars), so the tight `tag` radius
// keeps "this is a label" distinct from "this is pressable".

export function Badge({
  children,
  tone = "neutral",
  className,
  icon,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-tag px-2 py-1 tag outline outline-1 -outline-offset-1",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** Pill with a breathing dot — used for online / live states. */
export function LivePill({
  label,
  tone = "astra",
  className,
}: {
  label: string;
  tone?: "astra" | "neutral" | "warn" | "danger" | "robux";
  className?: string;
}) {
  const dot = {
    astra: "bg-astra",
    neutral: "bg-ink-mute",
    warn: "bg-warn",
    danger: "bg-danger",
    robux: "bg-robux",
  }[tone];

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-tag px-2 py-1 tag outline outline-1 -outline-offset-1",
        tones[tone === "neutral" ? "muted" : tone],
        className,
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span className={cx("absolute size-2 rounded-full opacity-60", dot)} style={{ animation: "breathe 3.6s ease-in-out infinite" }} />
        <span className={cx("size-1 rounded-full", dot)} />
      </span>
      {label}
    </span>
  );
}

export function TierBadge({ tier }: { tier: 1 | 2 | 3 }) {
  const map = {
    1: { label: "Seller Baru", tone: "muted" as Tone },
    2: { label: "Terverifikasi", tone: "info" as Tone },
    3: { label: "Top Vendor", tone: "astra" as Tone },
  }[tier];

  return (
    <Badge tone={map.tone} className="num">
      Tier {tier} · {map.label}
    </Badge>
  );
}
