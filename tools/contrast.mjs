// Ukur kontras pasangan token tema Roblox (merah, emas, hijau, netral).
// Ambang WCAG: 4.5:1 teks normal, 3:1 teks besar dan elemen non-teks.
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(n.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const T = {
  paper: "#ffffff",
  canvas: "#f6f6f7",
  canvas2: "#eeeeef",
  line: "#e5e5e7",
  lineStrong: "#d0d0d4",
  ink: "#16161a",
  inkDim: "#53535c",
  inkMute: "#6b6b74",
  astra: "#e2231a",
  astraInk: "#b3120a",
  astraWash: "#fdefee",
  astraMint: "#fbdcd9",
  success: "#166534",
  danger: "#b3120a",
  warn: "#8a5a00",
  info: "#53535c",
  robux: "#8a5a00",
  gold: "#f5b100",
};

// Tint helper for translucent fills such as `bg-info/15` over paper.
const tint = (hex, alpha, base = T.paper) => {
  const m = (h) => {
    const n = h.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [r1, g1, b1] = m(hex);
  const [r2, g2, b2] = m(base);
  const mix = (a, b) => Math.round(a * alpha + b * (1 - alpha));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
};

const checks = [
  ["putih di atas astra (tombol utama)", "#ffffff", T.astra, 4.5],
  ["putih di atas danger (tombol destruktif)", "#ffffff", T.danger, 4.5],
  ["ink di atas gold (lencana Robux)", T.ink, T.gold, 4.5],
  ["astra-ink di paper", T.astraInk, T.paper, 4.5],
  ["astra-ink di canvas", T.astraInk, T.canvas, 4.5],
  ["astra-ink di astra-wash", T.astraInk, T.astraWash, 4.5],
  ["astra-ink di astra-mint", T.astraInk, T.astraMint, 4.5],
  ["astra-ink di tint astra 12%", T.astraInk, tint(T.astra, 0.12), 4.5],
  ["ink di paper", T.ink, T.paper, 7],
  ["ink-dim di paper", T.inkDim, T.paper, 4.5],
  ["ink-dim di canvas", T.inkDim, T.canvas, 4.5],
  ["ink-dim di tint info 15%", T.inkDim, tint(T.info, 0.15), 4.5],
  ["ink-mute di paper", T.inkMute, T.paper, 4.5],
  ["ink-mute di canvas", T.inkMute, T.canvas, 4.5],
  ["ink-mute di canvas-2", T.inkMute, T.canvas2, 4.5],
  ["success di paper", T.success, T.paper, 4.5],
  ["danger di paper", T.danger, T.paper, 4.5],
  ["warn di paper", T.warn, T.paper, 4.5],
  ["robux di paper", T.robux, T.paper, 4.5],
  ["info di paper", T.info, T.paper, 4.5],
  ["line-strong vs paper (border)", T.lineStrong, T.paper, 1.4],
  ["line vs paper (hairline)", T.line, T.paper, 1.1],
  ["astra vs paper (cincin fokus)", T.astra, T.paper, 3],
  ["astra vs canvas (cincin fokus)", T.astra, T.canvas, 3],
];

let failed = 0;
for (const [label, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "GAGAL"} ${label}: ${r.toFixed(2)}:1 (min ${min})`);
}
console.log(failed ? `${failed} pasangan gagal` : "semua pasangan lolos");
