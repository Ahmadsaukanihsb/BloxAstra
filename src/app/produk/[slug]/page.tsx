import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { headers } from "next/headers";
import { getProductDetail, getProducts, getSellerMap } from "@/lib/catalog";
import { getCurrentUser } from "@/lib/auth";
import { getProductReviews } from "@/lib/orders";
import { getWishlistIds } from "@/lib/wishlist";
import { SITE_URL } from "@/lib/site";
import { formatNumber } from "@/lib/format";
import { Badge, LivePill, TierBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/feedback";
import { ProductImage, SellerAvatar, StarRating } from "@/components/ui/art";
import { ProductCard } from "@/components/product/product-card";
import { BuyBox } from "@/components/product/buy-box";
import { ReviewCard } from "@/components/order/review-form";
import { Reveal } from "@/components/ui/reveal";
import {
  IconAlert,
  IconBolt,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconClock,
  IconFingerprint,
  IconInfo,
  IconPackage,
  IconSealCheck,
  IconShieldCheck,
  IconTrendUp,
} from "@/components/ui/icons";

export async function generateMetadata(props: PageProps<"/produk/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const detail = await getProductDetail(slug);
  if (!detail) return { title: "Listing tidak ditemukan" };
  const url = `/produk/${detail.product.slug}`;
  const description = detail.product.description.slice(0, 160);
  return {
    title: detail.product.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: detail.product.title,
      description,
      url,
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: detail.product.title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

function ProductDetailsFallback() {
  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="bezel-shell aspect-[16/10] w-full animate-pulse rounded-card" />
          <div className="flex flex-col gap-4">
            <div className="h-8 w-2/3 animate-pulse rounded-control bg-canvas" />
            <div className="h-4 w-1/2 animate-pulse rounded-control bg-canvas" />
          </div>
        </div>
        <div className="bezel-shell h-96 animate-pulse rounded-card" />
      </div>
    </div>
  );
}

export default function ProductPage(props: PageProps<"/produk/[slug]">) {
  return (
    <Suspense fallback={<ProductDetailsFallback />}>
      <ProductDetails params={props.params} />
    </Suspense>
  );
}

async function ProductDetails({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connection();
  const [detail, allProducts, sellers, user] = await Promise.all([
    getProductDetail(slug),
    getProducts(),
    getSellerMap(),
    getCurrentUser(),
  ]);
  if (!detail) notFound();
  const { product, seller, category } = detail;
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const wishlisted = user
    ? (await getWishlistIds(user.id)).includes(product.id)
    : false;
  const similar = allProducts
    .filter((item) => item.category === product.category && item.slug !== product.slug)
    .slice(0, 3);

  return (
    <div className="shell pb-24 pt-24 md:pt-28">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: product.description.slice(0, 300),
            category: category.name,
            brand: { "@type": "Brand", name: seller.storeName },
            offers: {
              "@type": "Offer",
              url: `${SITE_URL}/produk/${product.slug}`,
              priceCurrency: "IDR",
              price: product.price,
              availability:
                product.stock > 0
                  ? "https://schema.org/InStock"
                  : "https://schema.org/OutOfStock",
              seller: { "@type": "Organization", name: seller.storeName },
            },
            aggregateRating:
              seller.reviewCount > 0
                ? {
                    "@type": "AggregateRating",
                    ratingValue: seller.rating,
                    reviewCount: seller.reviewCount,
                  }
                : undefined,
          }),
        }}
      />
      <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
        <Link href="/" className="transition-colors hover:text-ink">
          Beranda
        </Link>
        <IconChevronRight size={12} />
        <Link href="/katalog" className="transition-colors hover:text-ink">
          Katalog
        </Link>
        <IconChevronRight size={12} />
        <Link
          href={`/katalog?kategori=${product.category}`}
          className="transition-colors hover:text-ink"
        >
          {category.name}
        </Link>
        <IconChevronRight size={12} />
        <span className="max-w-[24ch] truncate text-ink-dim">{product.title}</span>
      </nav>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-6">
            <div className="bezel-shell p-1.5">
              <div className="bezel-core overflow-hidden p-1.5">
                <ProductImage
                  product={product}
                  className="aspect-[16/10] w-full rounded-card"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{product.game}</Badge>
              {seller.hasExpressBadge ? (
                <Badge tone="astra" icon={<IconBolt size={12} />}>
                  Garansi Kilat 10 Menit
                </Badge>
              ) : null}
              {product.instantDelivery ? (
                <Badge tone="info" icon={<IconBolt size={12} />}>
                  Kirim otomatis
                </Badge>
              ) : null}
              <LivePill
                tone={seller.isOnline ? "astra" : "neutral"}
                label={seller.isOnline ? "Penjual online" : "Penjual istirahat"}
              />
            </div>

 <h1 className="max-w-[30ch] font-display text-display font-extrabold text-ink md:text-display">
              {product.title}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2.5">
                <SellerAvatar name={seller.storeName} size={38} online={seller.isOnline} />
                <div className="flex flex-col gap-0.5">
                  <Link
                    href="/katalog"
                    className="text-[13px] font-bold text-ink transition-colors hover:text-astra-ink"
                  >
                    {seller.storeName}
                  </Link>
                  <StarRating rating={seller.rating} count={seller.reviewCount} size={11} />
                </div>
                <TierBadge tier={seller.tier} />
              </div>
              <span className="num flex items-center gap-1.5 text-[11px] text-ink-mute">
                <IconTrendUp size={13} />
                {formatNumber(product.sold)} terjual
              </span>
              <span className="num flex items-center gap-1.5 text-[11px] text-ink-mute">
                <IconClock size={13} />
                serah terima ~{Math.max(1, Math.round(seller.avgDeliverySeconds / 60))} menit
              </span>
              <span className="num flex items-center gap-1.5 text-[11px] text-ink-mute">
                <IconPackage size={13} />
                stok {formatNumber(product.stock)}
              </span>
            </div>

            <p className="max-w-[68ch] text-[13px] leading-relaxed text-ink-dim md:text-[14px]">
              {product.description}
            </p>

            <ul className="flex flex-col gap-2.5">
              {product.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 text-[13px] text-ink-dim">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-astra/12 text-astra-ink">
                    <IconCheck size={11} />
                  </span>
                  {highlight}
                </li>
              ))}
            </ul>
          </div>

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-5 p-6">
 <h2 className="text-base font-bold text-ink">Cara pemenuhan kategori ini</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {[
                  { label: "Metode", value: category.fulfillment },
                  { label: "SLA kategori", value: `${category.slaMinutes} menit` },
                  {
                    label: "Komisi platform",
                    value: `${category.commissionPercent.toFixed(1).replace(".", ",")}%`,
                  },
                  { label: "Pelepasan otomatis", value: `${product.autoReleaseHours} jam` },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-col gap-1 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
                  >
                    <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                      {row.label}
                    </span>
                    <span className="text-[13px] text-ink">{row.value}</span>
                  </div>
                ))}
              </div>

              <Notice tone="info" icon={<IconInfo size={15} />} title="Username dicek ke Roblox">
                Saat checkout, username tujuan diverifikasi langsung ke server Roblox. Kalau
                endpoint-nya sedang 429 atau 500, tombol cek username akan menampilkan pesan gagal. Pesanan tetap
                harus memakai username asli supaya barang tidak salah kirim.
              </Notice>
            </div>
          </div>

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-6 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
 <h2 className="text-base font-bold text-ink">Penilaian pembeli</h2>
                <div className="flex items-center gap-3">
                  <span className="num text-2xl font-extrabold text-ink">
                    {seller.rating.toFixed(2).replace(".", ",")}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <StarRating rating={seller.rating} size={12} />
                    <span className="text-[11px] text-ink-mute">
                      dari {formatNumber(seller.reviewCount)} ulasan
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  { label: "Sengketa", value: `${seller.disputeRatePercent.toFixed(2).replace(".", ",")}%` },
                  { label: "Order selesai", value: formatNumber(seller.ordersCompleted) },
                  { label: "Bergabung", value: seller.joinedOn.slice(0, 7) },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex flex-col gap-1 rounded-well bg-canvas p-4 outline outline-1 -outline-offset-1 outline-line"
                  >
                    <span className="text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                      {stat.label}
                    </span>
                    <span className="num text-[15px] font-bold text-ink">{stat.value}</span>
                  </div>
                ))}
              </div>

              <Suspense fallback={null}>
                <ProductReviewList productId={product.id} />
              </Suspense>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {[
              {
                icon: IconShieldCheck,
                title: "Penahanan dana terisolasi",
                body: "Dana masuk rekening penampungan, bukan saldo penjual.",
              },
              {
                icon: IconSealCheck,
                title: "KYC manual",
                body: "KTP asli + selfie bertanggal, tanpa foto dari internet.",
              },
              {
                icon: IconFingerprint,
                title: "Jejak perangkat",
                body: "Akun tersanksi memblokir pendaftaran ulang dari perangkat yang sama.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2.5 rounded-card bg-canvas p-5 outline outline-1 -outline-offset-1 outline-line"
              >
                <span className="grid size-9 place-items-center rounded-control bg-astra/[0.09] text-astra-ink">
                  <item.icon size={17} />
                </span>
                <span className="text-[13px] font-bold text-ink">{item.title}</span>
                <span className="text-[11px] leading-relaxed text-ink-mute">{item.body}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-28">
          <BuyBox product={product} seller={seller} category={category} wishlisted={wishlisted} />

          <div className="bezel-shell p-1.5">
            <div className="bezel-core flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3">
                <SellerAvatar name={seller.storeName} size={40} online={seller.isOnline} />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-ink">{seller.storeName}</span>
                  <span className="text-[11px] text-ink-mute">
                    {seller.city} · {formatNumber(seller.ordersCompleted)} order selesai
                  </span>
                </div>
              </div>
              <p className="text-[12px] leading-relaxed text-ink-mute">{seller.bio}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone="astra" icon={<IconShieldCheck size={12} />}>
                  KYC terverifikasi
                </Badge>
                {seller.hasExpressBadge ? <Badge tone="robux">Kilat 10 Menit</Badge> : null}
              </div>
              <div className="flex gap-2.5">
                <ButtonLink
                  href={`/katalog?penjual=${seller.handle}`}
                  variant="secondary"
                  fullWidth
                  size="sm"
                  leadingIcon={<IconChat size={14} />}
                >
                  Lihat semua listing {seller.storeName}
                </ButtonLink>
              </div>
            </div>
          </div>

          <Notice tone="danger" icon={<IconAlert size={15} />} title="Jangan pernah transaksi di luar platform">
            Penjual yang meminta transfer langsung atau mengajak ke luar Blox Astra kehilangan
            seluruh perlindungan dana. Laporkan lewat chat pesanan.
          </Notice>
        </div>
      </div>

      {similar.length ? (
        <Reveal className="mt-20">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
 <h2 className="font-display text-title font-extrabold text-ink">
                Listing {category.name} lainnya
              </h2>
              <ButtonLink
                href={`/katalog?kategori=${product.category}`}
                variant="secondary"
                size="sm"
                trailingIcon={<IconChevronRight size={15} />}
                iconCircleClassName="bg-canvas"
              >
                Lihat kategori
              </ButtonLink>
            </div>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((item) => (
                <ProductCard key={item.id} product={item} seller={sellers[item.sellerId]} />
              ))}
            </div>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}

async function ProductReviewList({ productId }: { productId: string }) {
  const reviews = await getProductReviews(productId);
  if (reviews.length === 0) {
    return (
      <p className="text-[12px] leading-relaxed text-ink-mute">
        Belum ada ulasan untuk listing ini. Jadilah pembeli pertama yang memberi penilaian setelah
        pesanan selesai.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}
