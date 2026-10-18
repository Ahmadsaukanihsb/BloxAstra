// Ukur kontras pasangan token tema lobi gelap (merah, emas, hijau, netral).
// Ambang WCAG: 4.5:1 teks normal, 3:1 teks besar dan elemen non-teks.
//
// Catatan tema gelap: permukaan TERANG adalah batas yang mengikat, bukan yang
// gelap, jadi setiap batas teks diukur terhadap `paper`.
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
  // permukaan
  canvas: "#0d0d11", // lantai halaman
  paper: "#17171d", // panel yang terangkat
  canvas2: "#08080b", // sumur di dalam panel
  // garis
  line: "#2b2b34",
  lineStrong: "#3d3d49",
  // teks
  ink: "#f2f2f5",
  inkDim: "#a6a6b2",
  inkMute: "#8e8e99",
  // merah Roblox
  astra: "#e2231a",
  astraBright: "#c9352c",
  astraInk: "#ff5347",
  astraWash: "#2a1114",
  // emas
  gold: "#f5b100",
  onGold: "#1a1408",
  // semantik
  success: "#4ed894",
  onBright: "#0d0d11",
  danger: "#ff5347",
  warn: "#f5b100",
  info: "#a6a6b2",
  robux: "#f5b100",
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
  // tombol utama: label putih di atas isian merah
  ["putih di atas astra (tombol utama)", "#ffffff", T.astra, 4.5],
  ["putih di atas astra-bright (hover)", "#ffffff", T.astraBright, 4.5],
  // Isian terang memakai label gelap. `on-bright` adalah satu-satunya label
  // untuk semua hue terang, jadi setiap pasangan di bawah harus lolos;
  // `text-white` di atas salah satunya adalah bug, bukan pilihan gaya.
  ["on-bright di atas danger", T.onBright, T.danger, 4.5],
  ["on-bright di atas success", T.onBright, T.success, 4.5],
  ["on-bright di atas gold/robux", T.onBright, T.gold, 4.5],
  ["on-bright di atas warn", T.onBright, T.warn, 4.5],
  ["on-bright di atas info", T.onBright, T.info, 4.5],
  ["on-bright di atas ink (blok terbalik)", T.onBright, T.ink, 4.5],
  ["on-bright di atas ink-mute", T.onBright, T.inkMute, 4.5],
  // label di atas isian emas selalu gelap
  ["on-gold di atas gold (lencana Robux)", T.onGold, T.gold, 4.5],
  // teks di permukaan
  ["ink di paper", T.ink, T.paper, 7],
  ["ink di canvas", T.ink, T.canvas, 7],
  ["ink-dim di paper", T.inkDim, T.paper, 4.5],
  ["ink-dim di canvas", T.inkDim, T.canvas, 4.5],
  ["ink-mute di paper (batas mengikat)", T.inkMute, T.paper, 4.5],
  ["ink-mute di canvas", T.inkMute, T.canvas, 4.5],
  ["ink-mute di canvas-2 (sumur)", T.inkMute, T.canvas2, 4.5],
  // merah sebagai teks
  ["astra-ink di paper", T.astraInk, T.paper, 4.5],
  ["astra-ink di canvas", T.astraInk, T.canvas, 4.5],
  ["astra-ink di astra-wash", T.astraInk, T.astraWash, 4.5],
  ["astra-ink di tint astra 10%", T.astraInk, tint(T.astra, 0.1), 4.5],
  ["astra-ink di tint astra 15%", T.astraInk, tint(T.astra, 0.15), 4.5],
  // emas sebagai teks
  ["gold di paper (angka Robux)", T.gold, T.paper, 4.5],
  ["gold di canvas", T.gold, T.canvas, 4.5],
  ["gold di tint gold 10%", T.gold, tint(T.gold, 0.1), 4.5],
  // semantik sebagai teks
  ["success di paper", T.success, T.paper, 4.5],
  ["success di tint success 10%", T.success, tint(T.success, 0.1), 4.5],
  ["danger di paper", T.danger, T.paper, 4.5],
  ["danger di tint danger 12%", T.danger, tint(T.danger, 0.12), 4.5],
  ["warn di paper", T.warn, T.paper, 4.5],
  ["robux di paper", T.robux, T.paper, 4.5],
  ["info di paper", T.info, T.paper, 4.5],
  ["ink-dim di tint info 15%", T.inkDim, tint(T.info, 0.15), 4.5],
  // batas dan cincin fokus (non-teks)
  ["line-strong vs paper (border)", T.lineStrong, T.paper, 1.4],
  ["line vs paper (hairline)", T.line, T.paper, 1.1],
  ["astra vs paper (cincin fokus)", T.astra, T.paper, 3],
  ["astra vs canvas (cincin fokus)", T.astra, T.canvas, 3],
  ["line-strong vs canvas (batas panel)", T.lineStrong, T.canvas, 1.4],
];

let failed = 0;
for (const [label, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "GAGAL"} ${label}: ${r.toFixed(2)}:1 (min ${min})`);
}
console.log(failed ? `${failed} pasangan gagal` : "semua pasangan lolos");
process.exitCode = failed ? 1 : 0;
