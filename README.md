# Blox Astra — Roblox Marketplace (Escrow)

Top up Robux, gamepass, item in-game, Gift Card, akun, dan Premium Roblox.
Dana pembeli ditahan platform sampai barang diterima; sengketa dimediasi
admin; penjual terverifikasi KYC.

Stack: Next.js 16 (App Router) · Prisma 6 · SQLite · Midtrans Snap ·
PM2 + Cloudflare Tunnel di satu PC Windows (lihat “Produksi”).

## Development

```bash
npm run dev        # http://localhost:3000
npm run lint       # eslint, harus bersih
npm test           # vitest (62 test, lib murni: pricing/format/throttle/discord/images/credentials/oauth/midtrans)
npx tsc --noEmit   # typecheck, harus bersih
npm run build      # WAJIB lolos sebelum deploy
```

Cakupan test saat ini: fungsi murni tanpa DB (`src/lib/*.test.ts`,
`server-only` di-stub). Kode yang menyentuh DB (actions, sweep, webhook)
**belum** ter-test — perubahan di sana wajib review + uji manual.

## Environment (.env)

| Key | Keterangan |
|---|---|
| `DATABASE_URL` | `file:./bloxastra.db` (SQLite lokal) |
| `SESSION_SECRET` | ≥32 char acak; ganti = semua sesi logout |
| `ENCRYPTION_KEY` | 64 hex char (32 byte); **jangan pernah ganti** — kredensial lama tak bisa dibuka lagi |
| `CRON_SECRET` | Bearer untuk `/api/cron/sweep` |
| `PAYMENT_PROVIDER` | `sim` (lokal) / `midtrans` (live) |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` | dari dashboard Midtrans |
| `MIDTRANS_IS_PRODUCTION` | `true` = uang asli. Sandbox dan production beda dashboard & webhook! |
| `NEXT_PUBLIC_SITE_URL` | `https://bloxastra.com` di produksi — dibakar saat build |
| OAuth Google/Discord | `*_CLIENT_ID/SECRET`; kosong = tombol login itu mati rapi |

Generate secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Produksi (PC ini = server)

| Komponen | Detail |
|---|---|
| Web | PM2 `bloxastra-web` → `next start -p 3132` |
| Tunnel | PM2 `bloxastra-tunnel` → `cloudflared tunnel run bloxastra` (ingress `bloxastra.com` + `www` → `127.0.0.1:3132`) |
| Boot | Scheduled Task `BloxAstraPM2` (At startup, SYSTEM) → `pm2 resurrect` |
| Sweep | Scheduled Task `BloxAstraSweep` (tiap 10 mnt, SYSTEM) → `POST /api/cron/sweep` |
| Backup | Scheduled Task `BloxAstraBackup` (harian 03:00, SYSTEM) → `BloxAstraBackup.cjs` → `BloxAstraBackups/`, retensi 7 |
| Log | `logs/` + `pm2 logs` (rotasi via `pm2-logrotate`: 10MB × 7, compress) |

Perintah harian:

```bash
pm2 list                 # status semua proses
pm2 logs bloxastra-web   # log aplikasi (error = bug; lihat ronde audit)
pm2 restart bloxastra-web --update-env && pm2 save   # habis ganti .env / deploy
```

## Deploy checklist

1. `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm test` ✅
2. `npm run build` ✅ (32–33 route, tak boleh ada error)
3. `pm2 restart bloxastra-web --update-env && pm2 save`
4. Verifikasi: `curl https://bloxastra.com/` → 200, klik 1 alur beli, cek pool seller
5. Kalau ganti schema Prisma: `pm2 stop bloxastra-web` → matikan dev server → `npx prisma db push` + `generate` → `pm2 start bloxastra-web` (JANGAN `Stop-Process -Name node`: membunuh daemon PM2 + dev sekaligus)

## Backup & restore (sudah di-drill, lolos)

- Backup: otomatis harian 03:00, snapshot konsisten via `node:sqlite serialize()`, cek integritas tiap file, log di `logs/backup.log`.
- Restore: `node C:\Users\Administrator\BloxAstraRestore.cjs [nama-file]` — **wajib stop web dulu** (`pm2 stop bloxastra-web`), script otomatis salin live DB ke `pre-restore-*` dulu, lalu `integrity_check`, lalu start lagi. Rollback = copy file `pre-restore-*` balik.
- Jangan pernah restore tanpa safety copy. Jangan edit `bloxastra.db` manual saat web jalan.

## Midtrans

- Webhook daftar di dashboard (sandbox & production TERPISAH!): `https://bloxastra.com/api/payments/midtrans`
- Kolom “Finish Redirect URL” dashboard boleh kosong — kode mengirim callback per-transaksi ke ruang pesanan (`/pesanan/BX-XXXXXX`).
- Order macet `pending_payment` padahal buyer sudah bayar → tombol “Saya sudah bayar — cek status” di ruang pesanan (tanya Status API langsung).

### Checklist sebelum terima uang asli

1. `.env`: `MIDTRANS_IS_PRODUCTION=true` + kunci production dari dashboard production. Boot menolak bila kunci kosong, tapi **tidak** bisa membedakan sandbox vs production dari formatnya (terbukti 2026-10-11: kunci tanpa `SB-` lolos auth sandbox) — verifikasi manual: cocokkan dengan dashboard yang sedang dibuka.
2. Dashboard Midtrans **production**: webhook URL terpasang, notifikasi sandbox dimatikan.
3. Uji 1 transaksi nominal terkecil sampai `paid` → pool seller → klaim → selesai → refund path.

## Perimeter: CSP + WAF Cloudflare

- CSP berjalan **report-only** (`content-security-policy-report-only`, nonce per-request via `src/proxy.ts`). Pelanggaran masuk `logs/` PM2 dengan prefix `[csp]`.
- Nonce dikirim di **request header** dan response header. Next tidak membaca `x-nonce` sama sekali; ia mengambil nonce dengan mengurai header CSP pada request yang masuk (`next/dist/server/route-modules/app-page/parse-request-headers.js`, yang membaca `content-security-policy` lalu `…-report-only`). Tanpa header itu, skrip framework dirender tanpa nonce dan tiap satunya dilaporkan sebagai pelanggaran.
- **Jangan enforce selama `cacheComponents` (PPR) menyala.** Diukur 2026-10-12 pada build produksi: tiga skrip inline tetap tanpa nonce — `requestAnimationFrame(…$RT…)`, `$RB/$RV` (skrip pembuka shell PPR), dan `_R_` (daftar chunk Turbopack). Ketiganya ditulis saat build, jadi nonce per-request tidak bisa menempelinya; `_R_` lagi memuat nama chunk yang berubah tiap build, jadi hash statis juga tidak bisa dipakai. Enforce = shell PPR tidak pernah terbuka dan isi halaman ikut hilang. Dua jalan bila memang mau enforce: matikan PPR untuk rute terkait (nonce menempel ke semua skrip saat render dinamis), atau terima tiga skrip itu sebagai pengecualian permanen dan tetap report-only.
- Rencana lama "setelah 1 minggu log bersih, ganti ke enforce" tidak bisa tercapai selama tiga skrip di atas ada — lognya tidak akan pernah bersih, jadi jangan menunggu sinyal itu.
- WAF Cloudflare (dashboard, tanpa kode):
  1. Rate limit `POST /api/payments/midtrans`: >30 req/mnt per IP → block 10 mnt.
  2. Rate limit `POST` ke `/masuk` + `/daftar`: >10 req/mnt per IP → Managed Challenge.
  3. (Opsional) `POST /api/*` hanya dari ID.
- JSON-LD inline memakai `nonce` dari header `x-nonce` (`layout.tsx`, `produk/[slug]/page.tsx`) — jangan hapus atributnya.

## Deploy

`npm run deploy` ([tools/deploy.mjs](tools/deploy.mjs)) — bukan `pm2 restart` saja, karena `next start` hanya menyajikan isi `.next` apa adanya:

1. build ke `.next-verify`; server lama tetap melayani, `.next` tidak pernah setengah jadi,
2. build gagal → staging dihapus, keluar kode 1, situs tidak tersentuh sama sekali,
3. build sukses → `bloxastra-web` dihentikan, `.next` ditukar, build lama disimpan di `.next-prev`,
4. proses dinyalakan lalu ditunggu sampai membalas HTTP 200; kalau tidak pernah siap, build lama dipasang kembali dan proses dijalankan ulang supaya situs tidak mati.

Catatan Windows: penukaran folder ditolak (`EPERM`) bila ada proses lain yang memegang `.next` — paling sering `next start` sisa di port lain yang bukan bagian dari `ecosystem.config.js`. Skrip menuliskan PID proses asing itu sebelum menukar, dan tetap menyalakan kembali web dengan build lama bila penukaran gagal; hentikan dulu proses tersebut, lalu jalankan deploy lagi.

## Troubleshooting 502 (Cloudflare Host Error)

Artinya origin tak menjawab. Cek berurutan: `pm2 list` (web online?) → `curl localhost:3132` (200?) → dashboard Cloudflare Zero Trust → Tunnels (connector Healthy?) → ingress hostname → port 3132. Jangan ubah-ubah config tunnel ganda; hanya SATU tunnel `bloxastra` yang jalan (`config-bloxastra.yml`).

## Batasan yang disadari (jangan "diperbaiki" sembarangan)

- SQLite single-writer: pola cek-saldo-di-dalam-transaksi aman di sini, akan jebol bila pindah Postgres tanpa row-lock.
- Rate-limit in-memory: hilang saat restart, satu instans saja.
- Session 7 hari fixed, tanpa sliding refresh.
- State `open_pool` mati (tak pernah dipakai) — biarkan, jangan hapus (risiko regresi stepper).
- Kode promo: batas global `maxUses`, belum ada batas per-user.
- Tidak ada infra email/WhatsApp — notifikasi hanya inbox aplikasi + webhook Discord seller.

## Janji tanpa implementasi (jangan dipakai sebagai copy lagi)

Copy dompet penjual sudah dipangkas ke perilaku yang benar-benar dijalankan sistem. Klaim berikut pernah tampil di UI tetapi **tidak punya kode yang menjalankannya** — teksnya sudah dibuang dari `src/components/wallet/wallet-view.tsx`; jangan dikembalikan sebelum fiturnya ada:

| Klaim lama | Kenapa belum benar | Kalau mau dihidupkan, di sini tempatnya |
|---|---|---|
| "Pencairan instan untuk Tier 3 · dana masuk di hari yang sama", "Tier 1 ditahan 3 hari, Tier 2 ditahan 24 jam" | `SellerProfile.tier` hanya memakai `TIER_DAILY_CAPS` untuk plafon harian. Tidak ada aturan waktu tahan per tier. | Butuh kolom/aturan hold per tier + penjadwalan pencairan. |
| "Rekening yang cocok dengan daftar hitam langsung ditolak otomatis", "nama pemilik rekening dicocokkan dengan daftar hitam" | `requestWithdrawal` hanya memvalidasi format 8–20 digit (`withdrawalSchema`). Tidak ada daftar hitam rekening maupun pencocokan nama KYC. | Tambah tabel blacklist + lookup sebelum `withdrawal.create`. |
| E-wallet "proses rata-rata 15 menit" + pilihan tujuan bank vs e-wallet | Disbursement tidak otomatis: `approveWithdrawal` hanya mengubah status `pending → paid`, transfer dilakukan admin di luar sistem. Pilihan tujuan bahkan tidak mengubah payload — `bank` yang dikirim selalu dari dropdown yang sama. | Integrasi disbursement + klasifikasi bank/e-wallet dari setting `banks`. |
| "Debit paksa berasal dari sengketa carding… Platform menalangi 100% dari Platform Protection Fund… selesaikan dalam 1×24 jam agar akun tidak dibekukan permanen" | **Tidak ada satu pun kode yang menulis `walletLedger.type = "penalty_debt"` atau `"protection_bailout"`.** `resolveDispute` dengan outcome `refund` mengembalikan dana ke pembeli dan tidak pernah mendebit penjual. Tidak ada field status akun di skema `User`, jadi tidak ada mekanisme pembekuan. Kartu "Piutang negatif" dan notice "debit paksa" karena itu selalu nol/sunyi. | Penulis ledger penalti (admin action) + status akun di skema. Penjaga blokir penarikan (`negativeDebt > 0`) sudah benar dan tetap dipakai kalau penulis itu dibuat. |
| "Ledger dua sisi" | Ledger-nya satu sisi: satu baris per mutasi dengan snapshot `balanceAfter` (perilaku itu asli dan tetap diklaim). Tidak ada pasangan debit/kredit. | — |

Pelanggan dapat membaca `TYPE_META.protection_bailout` di `wallet-view.tsx` sebagai label cadangan; baris seperti itu belum pernah bisa muncul sampai penulis penalti di atas dibuat.
