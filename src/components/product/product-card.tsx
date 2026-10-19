"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Product, Seller } from "@/lib/types";
import { formatIDR, formatNumber } from "@/lib/format";
import { productPrice } from "@/lib/robux-pricing";
import { cx } from "@/lib/cx";
import { ProductImage, SellerAvatar, StarRating } from "@/components/ui/art";
import { IconBolt, IconClock, IconFlame } from "@/components/ui/icons";
import { useRateCard } from "@/components/rates/rate-store";
import { WishlistButton } from "@/components/product/wishlist-button";

/** A tag that sits over listing artwork, so it needs a solid fill, never a tint. */
function ArtTag({
  children,
  icon,
  className,
}: {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-tag px-2 py-1 tag outline outline-1 -outline-offset-1",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function ProductCard({
  product,
  seller,
  className,
  style,
  layout = "grid",
  wishlisted = false,
}: {
  product: Product;
  seller: Seller;
  className?: string;
  style?: CSSProperties;
  layout?: "grid" | "row";
  wishlisted?: boolean;
}) {
  const rateCard = useRateCard();
  const price = productPrice(product, rateCard);
  const discount = product.compareAtPrice
    ? Math.round((1 - price / product.compareAtPrice) * 100)
    : null;

  if (layout === "row") {
    return (
      <Link
        href={`/produk/${product.slug}`}
        style={style}
        className={cx(
          "group flex items-center gap-4 rounded-card bg-paper p-2.5 outline outline-1 -outline-offset-1 outline-line transition-[outline-color,transform] duration-300 ease-[var(--ease-astra)] hover:outline-astra/50 active:translate-y-px",
          className,
        )}
      >
        <ProductImage
          product={product}
          className="size-16 shrink-0 rounded-well outline outline-1 -outline-offset-1 outline-line-strong"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate font-display text-[13px] font-extrabold text-ink">
            {product.title}
          </p>
          <div className="flex items-center gap-2 text-[11px] text-ink-mute">
            <span className="truncate">{seller.storeName}</span>
            <span className="size-1 rounded-full bg-ink-mute/60" />
            <span>{product.game}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="price text-[14px] text-gold">{formatIDR(price)}</span>
          <span className="text-[11px] text-ink-mute">
            {formatNumber(product.sold)} terjual
          </span>
        </div>
        <WishlistButton productId={product.id} initialSaved={wishlisted} size={15} />
      </Link>
    );
  }

  return (
    // One raised panel, not a tray holding a core: the nested double-bezel made
    // every tile read as the same rounded object at two scales.
    <Link href={`/produk/${product.slug}`} style={style} className={cx("lift group block", className)}>
      <div className="flex h-full flex-col overflow-hidden rounded-card bg-paper outline outline-1 -outline-offset-1 outline-line transition-[outline-color] duration-300 ease-[var(--ease-astra)] group-hover:outline-astra/50">
        <div className="relative overflow-hidden">
          <ProductImage product={product} className="aspect-[4/3] w-full" />

          <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
            {product.deliveryKind === "gamepass_auto" ? (
              <ArtTag icon={<IconBolt size={11} />} className="bg-astra text-white outline-astra-deep">
                Kilat 10 Menit
              </ArtTag>
            ) : product.deliveryKind === "instant_code" ? (
              <ArtTag className="bg-canvas/90 text-ink outline-line-strong backdrop-blur-sm">
                Kirim Otomatis
              </ArtTag>
            ) : null}
            {discount ? (
              <ArtTag
                icon={<IconFlame size={11} />}
                className="bg-gold text-on-gold outline-gold"
              >
                -{discount}%
              </ArtTag>
            ) : null}
          </div>

          <div className="absolute right-2.5 top-2.5">
            {/* A dot plus a word, so "online" is legible without spending
                another hue on it. */}
            <span className="inline-flex items-center gap-1.5 rounded-tag bg-canvas/90 px-2 py-1 tag text-ink outline outline-1 -outline-offset-1 outline-line-strong backdrop-blur-sm">
              <span
                className={cx(
                  "size-1.5 shrink-0 rounded-full",
                  seller.isOnline ? "bg-astra" : "bg-ink-mute",
                )}
              />
              {seller.isOnline ? "Online" : "Istirahat"}
            </span>
          </div>

          <div className="absolute bottom-2.5 right-2.5">
            <WishlistButton productId={product.id} initialSaved={wishlisted} size={15} />
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-3.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="tag text-ink-mute">{product.game}</span>
            <h3 className="font-display text-[15px] font-extrabold leading-snug tracking-tight text-ink">
              {product.title}
            </h3>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <SellerAvatar name={seller.storeName} size={26} imageUrl={seller.storeImage} />
              <div className="flex flex-col">
                <span className="truncate text-[11px] font-bold text-ink-dim">
                  {seller.storeName}
                </span>
                <StarRating rating={seller.rating} size={10} />
              </div>
            </div>
            <span className="num flex items-center gap-1 text-[11px] text-ink-mute">
              <IconClock size={12} />
              {Math.floor(seller.avgDeliverySeconds / 60)}m
            </span>
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
            <div className="flex flex-col">
              {product.compareAtPrice ? (
                <span className="num text-[11px] text-ink-mute line-through">
                  {formatIDR(product.compareAtPrice)}
                </span>
              ) : null}
              <span className="price text-[19px] text-gold">{formatIDR(price)}</span>
            </div>
            <span className="text-[11px] text-ink-mute">
              stok <span className="num text-ink-dim">{formatNumber(product.stock)}</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
