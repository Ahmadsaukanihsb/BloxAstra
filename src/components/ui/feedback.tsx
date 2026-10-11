import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "relative block overflow-hidden rounded-xl bg-canvas",
        className,
      )}
    >
      <span
        className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent"
        style={{ animation: "shimmer 2.2s linear infinite" }}
      />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-4 rounded-2xl bg-canvas px-6 py-14 text-center outline outline-1 -outline-offset-1 outline-dashed outline-line-strong",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-12 place-items-center rounded-2xl bg-canvas text-ink-mute">
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <p className="text-base font-bold text-ink">{title}</p>
        <p className="mx-auto max-w-[42ch] text-sm leading-relaxed text-ink-mute">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: "info" | "warn" | "danger" | "astra";
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const map = {
    info: "bg-info/[0.07] outline-info/25 text-info",
    warn: "bg-warn/[0.07] outline-warn/25 text-warn",
    danger: "bg-danger/[0.07] outline-danger/25 text-danger",
    astra: "bg-astra/[0.07] outline-astra/25 text-astra-ink",
  }[tone];

  return (
    <div
      className={cx(
        "flex gap-3 rounded-2xl p-4 outline outline-1 -outline-offset-1",
        map,
        className,
      )}
    >
      {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
      <div className="flex flex-col gap-1">
        {title ? <p className="text-sm font-extrabold text-ink">{title}</p> : null}
        <div className="text-xs leading-relaxed text-ink-dim">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "astra",
  className,
}: {
  value: number;
  tone?: "astra" | "warn" | "danger" | "robux";
  className?: string;
}) {
  const map = {
    astra: "bg-astra",
    warn: "bg-warn",
    danger: "bg-danger",
    robux: "bg-robux",
  }[tone];

  return (
    <span className={cx("block h-1.5 w-full overflow-hidden rounded-full bg-canvas", className)}>
      <span
        className={cx("block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-astra)]", map)}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </span>
  );
}
