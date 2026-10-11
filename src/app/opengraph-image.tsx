import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Brand share card — dependency-free so it never breaks the build. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          padding: 80,
          background: "linear-gradient(135deg, #160409 0%, #3d0a1e 55%, #0b0b10 100%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 16,
              background: "#E11D48",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 800,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Blox Astra</div>
        </div>
        <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          Top Up Robux &amp; Gamepass Roblox Murah
        </div>
        <div style={{ fontSize: 26, color: "#fda4af" }}>
          Dana ditahan sampai barang diterima · Penjual terverifikasi
        </div>
      </div>
    ),
    { ...size },
  );
}
