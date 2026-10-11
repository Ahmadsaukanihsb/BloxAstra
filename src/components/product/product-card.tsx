"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { Product, Seller } from "@/lib/types";
import { formatIDR, formatNumber } from "@/lib/format";
import { productPrice } from "@/lib/robux-pricing";
import { cx } from "@/lib/cx";
import { ProductImage, SellerAvatar, StarRating } from "@/components/ui/art";
import { Badge, LivePill } from "@/components/ui/badge";
import { IconBolt, IconClock, IconFlame } from "@/components/ui/icons";
import { useRateCard } from "@/components/rates/rate-store";
import { WishlistButton } from "@/components/product/wishlist-button";

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
        "group flex items-center gap-4 rounded-[1.4rem] bg-canvas p-2.5 outline outline-1 -outline-offset-1 outline-line transition-[background-color,transform,translate,scale,rotate] duration-500 ease-[var(--ease-astra)] hover:bg-canvas active:scale-[0.995]",
          className,
        )}
      >
        <ProductImage
          product={product}
          className="size-16 shrink-0 rounded-[1.05rem] outline outline-1 -outline-offset-1 outline-line-strong"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="truncate text-[13px] font-bold text-ink">{product.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-ink-mute">
            <span className="truncate">{seller.storeName}</span>
            <span className="size-1 rounded-full bg-ink-mute/60" />
            <span>{product.game}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="num text-[13px] font-extrabold text-ink">
            {formatIDR(price)}
          </span>
          <span className="text-[11px] text-ink-mute">
            {formatNumber(product.sold)} terjual
          </span>
        </div>
        <WishlistButton productId={product.id} initialSaved={wishlisted} size={15} />
      </Link>
    );
  }

  return (
    <Link
      href={`/produk/${product.slug}`}
      style={style}
      className={cx(
        "group block transition-transform duration-500 ease-[var(--ease-astra)] hover:-translate-y-1 active:scale-[0.995]",
        className,
      )}
    >
      <div className="bezel-shell h-full p-1.5">
        <div className="bezel-core flex h-full flex-col overflow-hidden">
          <div className="relative overflow-hidden rounded-[1.35rem]">
            <ProductImage product={product} className="aspect-[4/3] w-full" />
            <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
              {product.deliveryKind === "gamepass_auto" ? (
                <Badge tone="astra" icon={<IconBolt size={12} />} className="bg-paper/95 backdrop-blur-sm">
                  Kilat 10 Menit
                </Badge>
              ) : product.deliveryKind === "instant_code" ? (
                <Badge tone="info" icon={<IconBolt size={12} />} className="bg-paper/95 backdrop-blur-sm">
                  Kirim Otomatis
                </Badge>
              ) : null}
              {discount ? (
                <Badge tone="robux" icon={<IconFlame size={12} />} className="bg-paper/95 backdrop-blur-sm">
                  -{discount}%
                </Badge>
              ) : null}
            </div>
            <div className="absolute right-2.5 top-2.5">
              <LivePill
                tone={seller.isOnline ? "astra" : "neutral"}
                label={seller.isOnline ? "Online" : "Istirahat"}
                className="bg-paper/95 backdrop-blur-sm"
              />
            </div>
            <div className="absolute bottom-2.5 right-2.5">
              <WishlistButton productId={product.id} initialSaved={wishlisted} size={15} />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-3 p-3 pt-3.5">
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="text-[11px] uppercase tracking-[0.14em] text-ink-mute">{product.game}</p>
              <h3 className="text-[15px] font-bold leading-snug text-ink">{product.title}</h3>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SellerAvatar name={seller.storeName} size={26} />
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

            <div className="flex items-end justify-between gap-3 border-t border-hairline pt-3">
              <div className="flex flex-col">
                {product.compareAtPrice ? (
                  <span className="num text-[11px] text-ink-mute line-through">
                    {formatIDR(product.compareAtPrice)}
                  </span>
                ) : null}
                <span className="num text-[17px] font-extrabold text-ink">
                  {formatIDR(price)}
                </span>
              </div>
              <span className="text-[11px] text-ink-mute">
                stok <span className="num text-ink-dim">{formatNumber(product.stock)}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
