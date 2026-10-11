import type { ReactNode } from "react";
import type { CategorySlug, Product } from "@/lib/types";
import { seedFraction } from "@/lib/format";
import { cx } from "@/lib/cx";
import {
  IconCrown,
  IconGift,
  IconHexCoin,
  IconPackage,
  IconStar,
  IconUserSquare,
  RobuxGlyph,
} from "./icons";

const DUOTONES: { from: string; to: string; glow: string }[] = [
  { from: "#4a0d22", to: "#210510", glow: "rgba(244,63,94,0.36)" },
  { from: "#3a2a0c", to: "#191106", glow: "rgba(242,178,62,0.32)" },
  { from: "#0f2f49", to: "#071a29", glow: "rgba(90,169,255,0.3)" },
  { from: "#3a1720", to: "#1d0b11", glow: "rgba(255,107,107,0.26)" },
  { from: "#22300e", to: "#111a08", glow: "rgba(178,224,86,0.26)" },
];

const CATEGORY_GLYPH: Record<CategorySlug, (props: { size?: number; className?: string }) => ReactNode> = {
  gamepass: IconHexCoin,
  item: IconPackage,
  gift: IconGift,
  akun: IconUserSquare,
  premium: IconCrown,
};

/**
 * Generated listing artwork. Deterministic from the slug so a product always
 * renders the same tile — no remote images, no broken placeholders.
 */
export function ProductArt({
  seed,
  category,
  className,
  glyphClassName,
  label,
}: {
  seed: string;
  category: CategorySlug;
  className?: string;
  glyphClassName?: string;
  label?: string;
}) {
  const tone = DUOTONES[Math.floor(seedFraction(seed) * DUOTONES.length) % DUOTONES.length];
  const glowX = 22 + seedFraction(seed, 7) * 56;
  const glowY = 18 + seedFraction(seed, 13) * 44;
  const rotation = -14 + seedFraction(seed, 23) * 28;
  const Glyph = CATEGORY_GLYPH[category];

  return (
    <div
      className={cx("relative isolate overflow-hidden", className)}
      style={{ background: `linear-gradient(150deg, ${tone.from}, ${tone.to})` }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, ${tone.glow}, transparent 62%)`,
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 1px, transparent 1px 11px)",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          maskImage: "radial-gradient(circle at 50% 50%, black, transparent 72%)",
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/70"
        style={{ transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
      >
        <Glyph size={96} className={cx("drop-shadow-[0_10px_30px_rgba(0,0,0,0.45)]", glyphClassName)} />
      </div>

      <div className="absolute inset-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-40px_60px_-40px_rgba(0,0,0,0.8)]" />
      {label ? (
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 backdrop-blur-sm">
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Listing visual: real seller photo when the listing has one, generative art
 * otherwise. Same box model either way so tiles never shift.
 */
export function ProductImage({
  product,
  className,
  glyphClassName,
}: {
  product: Product;
  className?: string;
  glyphClassName?: string;
}) {
  if (product.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt={product.title}
        loading="lazy"
        className={cx("object-cover", className)}
      />
    );
  }
  return (
    <ProductArt
      seed={product.slug}
      category={product.category}
      className={className}
      glyphClassName={glyphClassName}
    />
  );
}

/** Monogram avatar with a deterministic gradient — stands in for Roblox headshots. */
export function SellerAvatar({
  name,
  size = 40,
  online,
  className,
}: {
  name: string;
  size?: number;
  online?: boolean;
  className?: string;
}) {
  const tone = DUOTONES[Math.floor(seedFraction(name, 3) * DUOTONES.length) % DUOTONES.length];
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <span
        aria-hidden="true"
        className={cx("relative inline-grid shrink-0 place-items-center", className)}
      >
        <span
          className="grid place-items-center rounded-2xl font-display font-extrabold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.36,
            background: `linear-gradient(140deg, ${tone.from}, ${tone.to})`,
          }}
        >
          {initials}
        </span>
        {online !== undefined ? (
          <span
            className={cx(
              "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-surface",
              online ? "bg-astra" : "bg-ink-mute",
            )}
          />
        ) : null}
      </span>
      {online !== undefined ? (
        <span className="sr-only">{online ? "Penjual sedang online" : "Penjual sedang offline"}</span>
      ) : null}
    </>
  );
}

export function StarRating({
  rating,
  count,
  size = 13,
  className,
}: {
  rating: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <span className={cx("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5 text-robux">
        {[1, 2, 3, 4, 5].map((index) => (
          <IconStar key={index} size={size} filled={index <= filled} />
        ))}
      </span>
      <span className="num text-xs font-bold text-ink">{rating.toFixed(2).replace(".", ",")}</span>
      {count !== undefined ? (
        <span className="text-[11px] text-ink-mute">({count.toLocaleString("id-ID")})</span>
      ) : null}
    </span>
  );
}

export function RobuxAmount({
  value,
  className,
  glyphSize = 14,
}: {
  value: string;
  className?: string;
  glyphSize?: number;
}) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-robux", className)}>
      <RobuxGlyph size={glyphSize} />
      <span className="num">{value}</span>
    </span>
  );
}
