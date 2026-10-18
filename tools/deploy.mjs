#!/usr/bin/env node
/**
 * Deploy aman untuk bloxastra-web.
 *
 * Masalah yang skrip ini selesaikan: `pm2 restart` tidak membangun apa pun, dan
 * `next build` menulis langsung ke `.next` yang sedang dibaca `next start`.
 * Dengan urutan "build dulu, restart kemudian", folder `.next` sempat setengah
 * jadi selama build, dan proses yang menyalakannya di jendela itu crash-loop
 * dengan "Could not find a production build in the '.next'". Itu pernah terjadi
 * sungguhan di mesin ini (30 baris galat dalam 18 detik).
 *
 * Urutannya sekarang:
 *   1. Bangun ke `.next-verify`. Server lama tidak disentuh, jadi tidak ada
 *      jendela di mana `.next` tidak lengkap.
 *   2. Build gagal → staging dihapus, keluar kode 1, situs tidak berubah.
 *   3. Build sukses → hentikan web, tukar ISI `.next` dengan build baru, simpan
 *      isi lama di `.next-prev` untuk rollback.
 *   4. Nyalakan lagi, tunggu sampai membalas HTTP 200. Kalau tidak pernah siap,
 *      build lama dipasang kembali dan prosesnya dijalankan ulang — deploy yang
 *      gagal tidak boleh meninggalkan situs mati.
 *
 * Kenapa menukar ISI, bukan mengubah nama foldernya: Windows menolak
 * `rename(".next", …)` selama proses lain memegang folder itu (di mesin ini
 * `next dev` ikut berjalan), tapi mengubah nama entri DI DALAM `.next` tetap
 * boleh — sudah diuji langsung. Karena itu pula tidak ada penyalinan 800MB:
 * seluruh penukaran hanya memindahkan nama, bukan byte.
 *
 * Pakai: npm run deploy
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(toolsDir, "..");

// Staging memakai nama `.next-verify`, bukan nama baru: `tsconfig.json` sudah
// memuat `.next-verify/types/**/*.ts`, jadi build tidak perlu menulis ulang
// `include` di sana — dengan nama lain, setiap deploy meninggalkan perubahan
// yang tidak diminta di tsconfig.
const STAGING = path.join(ROOT, ".next-verify");
const LIVE = path.join(ROOT, ".next");
const PREVIOUS = path.join(ROOT, ".next-prev");

/**
 * Entri yang bukan keluaran build dan tidak boleh ikut ditukar: `cache` adalah
 * cache build yang justru ingin dipertahankan, `dev` milik server pengembangan.
 */
const KEEP = new Set(["cache", "dev"]);

const ecosystem = require(path.join(ROOT, "ecosystem.config.js"));
const web = ecosystem.apps.find((app) => app.name.endsWith("-web"));
if (!web) {
  console.error("[deploy] tidak menemukan proses dengan nama berakhiran '-web' di ecosystem.config.js");
  process.exit(1);
}
const APP = web.name;
const PORT = Number(web.env?.PORT ?? String(web.args).match(/-p\s+(\d+)/)?.[1] ?? 3000);
const ORIGIN = `http://127.0.0.1:${PORT}`;

function log(step, message) {
  console.log(`[deploy] ${step.padEnd(9)} ${message}`);
}

function pm2(args) {
  return spawnSync("pm2", args, { cwd: ROOT, shell: true, encoding: "utf8" });
}

function pm2Status() {
  const out = pm2(["jlist"]);
  if (out.status !== 0) return null;
  try {
    const app = JSON.parse(out.stdout).find((p) => p.name === APP);
    return app ? app.pm2_env.status : null;
  } catch {
    return null;
  }
}

async function isUp() {
  try {
    const res = await fetch(ORIGIN, { signal: AbortSignal.timeout(4000) });
    return res.status === 200;
  } catch {
    return false;
  }
}

/** Menunggu sampai proses benar-benar berhenti — bukan sekadar perintah stop terkirim. */
async function stopWeb() {
  pm2(["stop", APP]);
  for (let i = 0; i < 30; i++) {
    const status = pm2Status();
    if (status === "stopped" || status === null) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function startWebAndWait() {
  pm2(["restart", APP]);
  for (let i = 0; i < 40; i++) {
    if (await isUp()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function buildEntries(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((entry) => !KEEP.has(entry));
}

/** Pindahkan semua entri `from` ke `to`, tanpa penyalinan byte. */
function moveEntries(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of buildEntries(from)) {
    fs.renameSync(path.join(from, entry), path.join(to, entry));
  }
}

/** Pasang build baru, simpan yang lama di `.next-prev`. */
function swapContents() {
  fs.rmSync(PREVIOUS, { recursive: true, force: true });
  moveEntries(LIVE, PREVIOUS);
  moveEntries(STAGING, LIVE);
}

/** Pasang kembali build lama setelah deploy yang gagal. */
function rollbackContents() {
  log("rollback", "memasang kembali build sebelumnya");
  moveEntries(LIVE, STAGING);
  moveEntries(PREVIOUS, LIVE);
}

async function main() {
  const started = Date.now();
  log("build", `membangun ke ${path.relative(ROOT, STAGING)} (situs tetap melayani)`);
  fs.rmSync(STAGING, { recursive: true, force: true });

  const build = spawnSync("npx", ["next", "build"], {
    cwd: ROOT,
    shell: true,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, NEXT_DIST_DIR: ".next-verify" },
  });

  if (build.status !== 0) {
    fs.rmSync(STAGING, { recursive: true, force: true });
    log(
      "gagal",
      `build keluar dengan kode ${build.status}. Situs masih melayani build lama; tidak ada yang berubah.`,
    );
    process.exit(1);
  }
  log("build", `selesai dalam ${Math.round((Date.now() - started) / 1000)}s`);

  log("stop", `menghentikan ${APP}`);
  if (!(await stopWeb())) {
    log("gagal", `${APP} tidak mau berhenti; tidak ada folder yang ditukar.`);
    process.exit(1);
  }

  log("swap", "memasang build baru, menyimpan yang lama di .next-prev");
  try {
    swapContents();
  } catch (error) {
    log("gagal", `penukaran terhenti: ${error.message}`);
    log("penting", `memasang kembali build lama dan menyalakan ${APP} supaya situs tidak mati.`);
    try {
      rollbackContents();
    } catch (rollbackError) {
      log("kritis", `rollback juga gagal: ${rollbackError.message}. Periksa .next dan .next-prev manual.`);
    }
    await startWebAndWait();
    process.exit(1);
  }

  log("start", `menjalankan ${APP} dan menunggu ${ORIGIN} membalas 200`);
  if (await startWebAndWait()) {
    log(
      "sukses",
      `situs hidup dengan build baru (${Math.round((Date.now() - started) / 1000)}s). Build lama ada di .next-prev bila perlu rollback manual.`,
    );
    return;
  }

  log("gagal", `${ORIGIN} tidak pernah membalas 200. Mengembalikan build sebelumnya.`);
  await stopWeb();
  try {
    rollbackContents();
  } catch (error) {
    log("kritis", `rollback gagal: ${error.message}`);
  }
  const recovered = await startWebAndWait();
  log(
    recovered ? "ok" : "kritis",
    recovered
      ? "situs kembali hidup dengan build lama. Periksa output build di atas."
      : `situs TIDAK hidup kembali. Jalankan pm2 logs ${APP} sekarang.`,
  );
  process.exit(recovered ? 1 : 2);
}

await main();
