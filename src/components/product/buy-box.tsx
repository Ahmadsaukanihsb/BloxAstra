"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatIDR, formatNumber } from "@/lib/format";
import { listingQuote } from "@/lib/robux-pricing";
import { useRateCard } from "@/components/rates/rate-store";
import type { Category, Product, Seller } from "@/lib/types";
import { cx } from "@/lib/cx";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, Button } from "@/components/ui/button";
import { OptionCard } from "@/components/ui/field";
import { Notice } from "@/components/ui/feedback";
import { RobuxAmount, SellerAvatar, StarRating } from "@/components/ui/art";
import { WishlistButton } from "@/components/product/wishlist-button";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconInfo,
  IconLock,
  IconMinus,
  IconPlus,
  IconShieldCheck,
  IconTimer,
} from "@/components/ui/icons";

export function BuyBox({
  product,
  seller,
  category,
  wishlisted = false,
}: {
  product: Product;
  seller: Seller;
  category: Category;
  wishlisted?: boolean;
}) {
  const rateCard = useRateCard();
  const isGamepass = product.category === "gamepass";
  const baseNet = product.netRobux ?? 0;

  const [mode, setMode] = useState<"cover" | "no_cover">(
    product.pricingMode ?? "cover",
  );
  const [quantity, setQuantity] = useState(1);

  /** Advertised deal for a single unit — what the option cards explain. */
  const unitQuote = useMemo(
    () => (isGamepass ? listingQuote(baseNet, mode, 1, rateCard) : null),
    [isGamepass, mode, baseNet, rateCard],
  );
  /** What quantity actually costs — the same engine checkout quotes from. */
  const quote = useMemo(
    () => (isGamepass ? listingQuote(baseNet, mode, quantity, rateCard) : null),
    [isGamepass, mode, baseNet, quantity, rateCard],
  );

  const subtotal = quote ? quote.totalIdr : product.price * quantity;
  const unitPrice = Math.round(subtotal / quantity);
  const platformFee = Math.round((subtotal * category.commissionPercent) / 100);
  const total = subtotal + platformFee;
  const maxQuantity = Math.min(5, Math.max(1, product.stock));

  return (
    <div className="bezel-shell p-1.5">
      <div className="bezel-core flex flex-col gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Harga satuan
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={unitPrice}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="num text-[26px] font-extrabold leading-tight text-ink"
              >
                {formatIDR(unitPrice)}
              </motion.span>
            </AnimatePresence>
          </div>
          {seller.hasExpressBadge ? (
            <Badge tone="astra" icon={<IconBolt size={12} />}>
              Kilat {Math.round(seller.avgDeliverySeconds / 60) || 10} Menit
            </Badge>
          ) : (
            <Badge tone="neutral" icon={<IconTimer size={12} />}>
              SLA {category.slaMinutes} menit
            </Badge>
          )}
        </div>

        {isGamepass && unitQuote ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <OptionCard
                selected={mode === "cover"}
                onSelect={() => setMode("cover")}
                title="Robux Bersih (Cover Tax)"
                description={`Pasang gamepass ${formatNumber(
                  unitQuote.gamepassPrice,
                )} Robux — kamu terima ${formatNumber(unitQuote.netRobux)} Robux.`}
              />
              <OptionCard
                selected={mode === "no_cover"}
                onSelect={() => setMode("no_cover")}
                title="Robux Kotor (No Cover Tax)"
                description={`Pasang gamepass seharga ${formatNumber(
                  unitQuote.gamepassPrice,
                )} Robux — kamu terima ${formatNumber(
                  unitQuote.netRobux,
                )} Robux setelah pajak Roblox.`}
              />
            </div>

            <div className="flex flex-col gap-2 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">Nominal gamepass yang dipasang</span>
                <RobuxAmount value={formatNumber(unitQuote.gamepassPrice)} glyphSize={14} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">Robux diterima akunmu</span>
                <span className="num text-ink">{formatNumber(unitQuote.netRobux)}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">Pajak marketplace Roblox</span>
                <span className="num text-danger">−{formatNumber(unitQuote.taxRobux)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-4 border-t border-hairline pt-5">
          <span className="text-[11px] uppercase tracking-[0.16em] text-ink-mute">Jumlah</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Kurangi jumlah"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="grid size-9 place-items-center rounded-full bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink disabled:opacity-40"
            >
              <IconMinus size={15} />
            </button>
            <span className="num w-8 text-center text-sm font-bold text-ink">{quantity}</span>
            <button
              type="button"
              aria-label="Tambah jumlah"
              disabled={quantity >= maxQuantity}
              onClick={() => setQuantity((value) => Math.min(maxQuantity, value + 1))}
              className="grid size-9 place-items-center rounded-full bg-canvas text-ink-dim outline outline-1 -outline-offset-1 outline-line transition-colors duration-300 hover:text-ink disabled:opacity-40"
            >
              <IconPlus size={15} />
            </button>
            <span className="text-[11px] text-ink-mute">
              maks <span className="num">{maxQuantity}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-2xl bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line">
          <Row label="Subtotal" value={formatIDR(subtotal)} />
          <Row
            label={`Komisi platform (${category.commissionPercent.toFixed(1).replace(".", ",")}%)`}
            value={formatIDR(platformFee)}
          />
          <div className="mt-1.5 flex items-center justify-between border-t border-hairline pt-2.5">
            <span className="text-[11px] uppercase tracking-[0.16em] text-ink-mute">
              Ditahan platform
            </span>
            <span className="num text-[15px] font-extrabold text-astra-ink">{formatIDR(total)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {product.stock === 0 ? (
            <Button variant="secondary" fullWidth size="lg" disabled>
              Stok habis
            </Button>
          ) : (
            <ButtonLink
              href={`/checkout?produk=${product.slug}&mode=${mode}&qty=${quantity}`}
              size="lg"
              fullWidth
              trailingIcon={<IconArrowRight size={16} />}
              iconCircleClassName="bg-white/20"
            >
              Checkout aman
            </ButtonLink>
          )}
          <WishlistButton
            productId={product.id}
            initialSaved={wishlisted}
            size={19}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-canvas text-ink-mute outline outline-1 -outline-offset-1 outline-line transition-colors duration-200 hover:text-astra-ink"
          />
        </div>

        <ul className="flex flex-col gap-2.5 border-t border-hairline pt-4">
          {[
            { icon: IconShieldCheck, text: "Dana ditahan sampai kamu menekan konfirmasi." },
            { icon: IconTimer, text: `Auto-release setelah ${product.autoReleaseHours} jam tanpa sengketa.` },
            { icon: IconCheck, text: "Batal otomatis + refund penuh jika penjual diam 30 menit." },
            { icon: IconLock, text: "Bukti serah terima dibubuhi watermark resmi per order." },
          ].map((item) => (
            <li key={item.text} className="flex items-start gap-2.5 text-[11px] text-ink-dim">
              <item.icon size={14} className="mt-0.5 shrink-0 text-astra-ink" />
              {item.text}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <SellerAvatar name={seller.storeName} size={30} online={seller.isOnline} />
          <div className="flex flex-col">
            <span className="text-[12px] font-bold text-ink-dim">{seller.storeName}</span>
            <StarRating rating={seller.rating} count={seller.reviewCount} size={10} />
          </div>
          <span className={cx("ml-auto num text-[11px]", seller.isOnline ? "text-astra-ink" : "text-ink-mute")}>
            {seller.isOnline ? "siap kirim" : "istirahat"}
          </span>
        </div>

        {product.category === "premium" || product.category === "akun" ? (
          <Notice tone="warn" icon={<IconInfo size={15} />}>
            Produk ini butuh serah terima kredensial. Nyalakan Parental PIN Roblox sebelum
            menyerahkan akun — PIN akan mengunci email, nomor HP, dan kata sandi dari perubahan.
          </Notice>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-ink-mute">{label}</span>
      <span className="num text-ink-dim">{value}</span>
    </div>
  );
}
