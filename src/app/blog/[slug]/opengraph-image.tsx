import { ImageResponse } from "next/og";
import { formatBlogDate, getBlogPostBySlug } from "@/lib/blog";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Artikel Blog Blox Astra";

/** Keep the headline to two short lines — Satori does not clip for us. */
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * Share card per article: headline, tanggal, menit baca. Slug tak dikenal
 * (draft atau dihapus) jatuh ke kartu blog generik, jadi tautan yang dibagikan
 * tidak pernah berakhir sebagai 500.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);

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

  if (!post) {
    return new ImageResponse(
      shell(
        <>
          {brand}
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1.6 }}>
            Panduan &amp; tips Robux
          </div>
          <div style={{ fontSize: 24, color: "#fbdcd9" }}>Blog Blox Astra</div>
        </>,
      ),
      { ...size },
    );
  }

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
            Blog
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.12, letterSpacing: -1.8 }}>
            {truncate(post.title, 88)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 24, color: "#fbdcd9" }}>
            {post.publishedAt ? <span>{formatBlogDate(post.publishedAt)}</span> : null}
            <span>·</span>
            <span>{post.readingMinutes} menit baca</span>
          </div>
        </div>

        <div style={{ fontSize: 24, color: "#fbdcd9" }}>
          Beli Robux dengan dana ditahan sampai barang diterima
        </div>
      </>,
    ),
    { ...size },
  );
}
