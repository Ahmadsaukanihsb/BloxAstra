import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "robux";
type Size = "sm" | "md" | "lg";

const base =
  "group relative inline-flex select-none items-center justify-center gap-2.5 rounded-control font-bold whitespace-nowrap transition duration-200 ease-[var(--ease-astra)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  // `sheen` (globals.css) sweeps one light pass across the fill on hover; it is
  // transform-only and honours prefers-reduced-motion like the rest of the app.
  primary: "sheen bg-astra text-white hover:bg-astra-deep",
  secondary:
    "bg-paper text-ink outline outline-1 -outline-offset-1 outline-line hover:bg-canvas",
  ghost: "bg-transparent text-ink-dim hover:bg-canvas hover:text-ink",
  danger:
    "bg-danger/12 text-danger outline outline-1 -outline-offset-1 outline-danger/30 hover:bg-danger/20",
  robux:
    "bg-robux/12 text-robux outline outline-1 -outline-offset-1 outline-robux/30 hover:bg-robux/20",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-[0.95rem]",
};

const iconCircle: Record<Size, string> = {
  sm: "size-6",
  md: "size-7",
  lg: "size-9",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** trailing icon rendered inside its own nested circle (button-in-button) */
  trailingIcon?: ReactNode;
  leadingIcon?: ReactNode;
  fullWidth?: boolean;
  iconCircleClassName?: string;
}

function inner(
  props: CommonProps & { children: ReactNode; fullWidth?: boolean },
) {
  const { children, leadingIcon, trailingIcon, size = "md" } = props;
  return (
    <>
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span className="truncate">{children}</span>
      {trailingIcon ? (
        <span
          className={cx(
            "grid shrink-0 place-items-center rounded-full transition-transform duration-300 ease-[var(--ease-astra)] group-hover:translate-x-0.5 group-hover:-translate-y-px",
            iconCircle[size],
            props.iconCircleClassName ?? "bg-paper/20",
          )}
        >
          {trailingIcon}
        </span>
      ) : null}
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  trailingIcon,
  leadingIcon,
  iconCircleClassName,
  className,
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={cx(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {inner({ children, leadingIcon, trailingIcon, size, iconCircleClassName })}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  fullWidth,
  trailingIcon,
  leadingIcon,
  iconCircleClassName,
  className,
  children,
  ...rest
}: CommonProps & ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={cx(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {inner({ children, leadingIcon, trailingIcon, size, iconCircleClassName })}
    </Link>
  );
}
