// Migrasi sekali pakai untuk tema gelap. Dua aturan, keduanya sempit dan bisa
// diperiksa ulang dengan grep.
//
// ATURAN 1 — label di atas isian terang.
// Tema terang memakai satu nilai per hue semantik, jadi `text-white` legal di
// atas isian gelap mana pun. Tema gelap membalik tekstur itu: isian jadi
// terang, sehingga labelnya harus gelap. Hanya tukar bila pada baris yang sama
// ada ISIAN SOLID dari hue terang (tanpa sufiks `/opacity`, karena tint tetap
// gelap dan justru butuh label terang). `bg-astra text-white` tidak disentuh:
// merah tetap membawa label putih pada 4.68:1.
//
// ATURAN 2 — `text-astra` sebagai warna teks.
// `--color-astra` adalah warna ISIAN. Di tema terang ia lolos tipis sebagai
// teks (4.69:1 di atas putih); di tema gelap jatuh ke 3.81:1 dan gagal AA.
// Warna teks merah punya token sendiri, `--color-astra-ink`.
import fs from "node:fs";
import path from "node:path";

const ROOT = "src";
const SOLID_BRIGHT_FILL =
  /bg-(success|danger|robux|warn|info|ink|ink-mute)(?![/\w-])/;
// `text-astra` diikuti akhir kata, kutip, spasi, atau sufiks `/opacity`.
// `text-astra-ink` dan `-deep` dikecualikan oleh lookahead.
const TEXT_ASTRA = /text-astra(?=[/"'\s])/g;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && full.endsWith(".tsx") ? [full] : [];
  });
}

const changed = [];
for (const file of walk(ROOT)) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let touched = false;
  const next = lines.map((line) => {
    let out = line;
    if (out.includes("text-white") && SOLID_BRIGHT_FILL.test(out)) {
      out = out.replaceAll("text-white", "text-on-bright");
    }
    if (out.includes("text-astra")) {
      out = out.replace(TEXT_ASTRA, "text-astra-ink");
    }
    if (out !== line) touched = true;
    return out;
  });
  if (touched) {
    fs.writeFileSync(file, next.join("\n"));
    changed.push(file);
  }
}

console.log(`berkas diubah: ${changed.length}`);
for (const file of changed) console.log(`  ${file}`);
