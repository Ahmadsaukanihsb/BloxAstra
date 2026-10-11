import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cx } from "@/lib/cx";

const controlBase =
  "w-full rounded-2xl bg-canvas px-4 text-sm text-ink placeholder:text-ink-mute outline outline-1 -outline-offset-1 outline-line transition-[outline-color,background-color,box-shadow] duration-300 ease-[var(--ease-astra)] focus:bg-canvas focus:outline-2 focus:-outline-offset-2 focus:outline-astra/70";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink-mute"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-xs text-danger">
          <span className="mt-px inline-block size-1.5 shrink-0 translate-y-1 rounded-full bg-danger" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-ink-mute">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({
  className,
  invalid,
  ...rest
}: ComponentPropsWithoutRef<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cx(
        controlBase,
        "h-12",
        invalid && "outline-2 -outline-offset-2 outline-danger/70",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function TextArea({
  className,
  ...rest
}: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cx(controlBase, "min-h-28 py-3 leading-relaxed", className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cx(controlBase, "h-12 appearance-none bg-surface-2 pr-10", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: string;
  meta?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

/** Selectable option row used by payment methods, tax modes, and shipping-like choices. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  meta,
  icon,
  disabled,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cx(
        "group flex w-full items-start gap-3.5 rounded-2xl p-4 text-left transition-[background-color,outline-color,transform,translate,scale,rotate] duration-300 ease-[var(--ease-astra)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-40",
        selected
          ? "bg-astra/[0.07] outline outline-2 -outline-offset-2 outline-astra/60"
          : "bg-canvas outline outline-1 -outline-offset-1 outline-line hover:bg-canvas",
      )}
    >
      {icon ? (
        <span
          className={cx(
            "mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl transition-colors duration-300",
            selected ? "bg-astra/15 text-astra-ink" : "bg-canvas text-ink-dim",
          )}
        >
          {icon}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-bold text-ink">{title}</span>
          {meta ? <span className="shrink-0 text-xs text-ink-dim">{meta}</span> : null}
        </span>
        {description ? (
          <span className="text-xs leading-relaxed text-ink-mute">{description}</span>
        ) : null}
      </span>
      <span
        className={cx(
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full transition-colors duration-300",
          selected ? "bg-astra" : "bg-canvas outline outline-1 -outline-offset-1 outline-line-strong",
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  id: string;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 ease-[var(--ease-astra)] hover:bg-canvas"
    >
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-md bg-canvas outline outline-1 -outline-offset-1 outline-line-strong transition-colors duration-200 checked:bg-astra checked:outline-astra"
        />
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none relative size-3 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5 6.2 12 13 4.5" />
        </svg>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm leading-snug text-ink">{label}</span>
        {description ? (
          <span className="text-xs leading-relaxed text-ink-mute">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
