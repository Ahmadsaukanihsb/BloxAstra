import { ImageResponse } from "next/og";
import { getProductDetail } from "@/lib/catalog";
import { formatIDR } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Listing Blox Astra";

/** Keep the headline to one or two lines — Satori does not clip for us. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Per-listing share card: title, price, and store. Falls back to the generic
 * brand card when the slug is unknown (unlisted or deleted), so a shared link
 * never resolves to a 500.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getProductDetail(slug);

  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: "#e2231a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 800,
        }}
      >
        B
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.8, color: "#fff" }}>
        Blox Astra
      </div>
    </div>
  );

  const shell = (children: React.ReactNode) => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #2a0605 0%, #6d1009 55%, #121216 100%)",
        color: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      {children}
    </div>
  );

  if (!detail) {
    return new ImageResponse(
      shell(
        <>
          {brand}
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.6 }}>
            Top Up Robux &amp; Gamepass Roblox Murah
          </div>
          <div style={{ fontSize: 24, color: "#fbdcd9" }}>
            Dana ditahan sampai barang diterima · Penjual terverifikasi
          </div>
        </>,
      ),
      { ...size },
    );
  }

  const { product, seller, category } = detail;

  return new ImageResponse(
    shell(
      <>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {brand}
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fbdcd9",
              border: "1px solid rgba(251,220,217,0.35)",
              borderRadius: 12,
              padding: "8px 18px",
            }}
          >
            {category.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 62, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>
            {truncate(product.title, 70)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ fontSize: 46, fontWeight: 800, color: "#8ff0a4" }}>
              {formatIDR(product.price)}
            </div>
            <div style={{ fontSize: 24, color: "#fbdcd9" }}>
              {product.instantDelivery ? "Kirim otomatis" : `Serah terima ~${Math.max(1, Math.round(seller.avgDeliverySeconds / 60))} menit`}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#fbdcd9" }}>
            {truncate(seller.storeName, 40)}
          </div>
          <div style={{ fontSize: 22, color: "#fbdcd9" }}>Dana ditahan sampai barang diterima</div>
        </div>
      </>,
    ),
    { ...size },
  );
}