# Blox Astra — Roblox Marketplace (Escrow)

Top up Robux, gamepass, item in-game, Gift Card, akun, dan Premium Roblox.
Dana pembeli ditahan platform sampai barang diterima; sengketa dimediasi
admin; penjual terverifikasi KYC.

Stack: Next.js 16 (App Router) · Prisma 6 · SQLite · Tripay (Midtrans hanya
untuk invoice lama) · PM2 + Cloudflare Tunnel di satu PC Windows (lihat
“Produksi”). Blog dilayani dari subdomain `blog.bloxastra.com` oleh app yang
sama (host routing di `src/proxy.ts`); URL lama `bloxastra.com/blog*` di-301
ke sana.

## Development

```bash
npm run dev        # http://localhost:3000
npm run lint       # eslint, harus bersih
npm test           # vitest: unit test lib murni + integration test dengan SQLite sementara
npx tsc --noEmit   # typecheck, harus bersih
npm run build      # WAJIB lolos sebelum deploy

npm run db:seed    # data contoh; DESTRUKTIF — mengosongkan tabel yang di-seed
npm run db:studio  # Prisma Studio
```

Test suite: **196 test / 20 file** (±2 detik). `src/lib/*.test.ts` menguji fungsi
murni tanpa DB. `test/*.integration.test.ts` membuat SQLite sementara dari
`prisma/schema.prisma`, lalu menguji jalur tulis/timpa API blog (termasuk aturan
Next bahwa `updateTag` hanya boleh dipanggil dari Server Action), state machine
notifikasi pembayaran, dan signature webhook Tripay. Sisa kode yang menyentuh DB
(sebagian besar server action, sweep, refund) **belum** ter-test — perubahan di
sana wajib review + uji manual.

## Environment (.env)

Template lengkap: [.env.example](.env.example). `src/lib/env.ts` memvalidasi saat
boot; di produksi server **menolak start** bila kunci wajib kosong,
`SESSION_SECRET` < 32 karakter, `ENCRYPTION_KEY` bukan 64 hex, atau provider
bukan `tripay`/`midtrans`.

**Inti**

| Key | Keterangan |
|---|---|
| `DATABASE_URL` | Path SQLite **absolut** (`file:C:/.../prisma/bloxastra.db`). Path relatif resolve berbeda antara `prisma` CLI dan proses app. |
| `SESSION_SECRET` | ≥32 char; ganti = semua sesi logout. Juga mengunci cookie state OAuth. |
| `ENCRYPTION_KEY` | 64 hex char (32 byte) untuk AES-256-GCM kredensial order. **Jangan pernah ganti** — blob lama tidak bisa dibuka. |
| `NEXT_PUBLIC_SITE_URL` | `https://bloxastra.com` di produksi; dipakai untuk URL absolut & redirect. Nilai `NEXT_PUBLIC_*` ikut dibundel saat build. |
| `NEXT_PUBLIC_BLOG_URL` | Default `https://blog.bloxastra.com`; host blog yang di-route `src/proxy.ts`. |

**Pembayaran**

| Key | Keterangan |
|---|---|
| `PAYMENT_PROVIDER` | `sim` (lokal), `tripay` (live), atau `midtrans` (legacy). Produksi hanya menerima `tripay`/`midtrans`. |
| `TRIPAY_API_KEY` / `TRIPAY_PRIVATE_KEY` / `TRIPAY_MERCHANT_CODE` | Wajib saat provider `tripay`. Private key juga memverifikasi signature webhook. |
| `TRIPAY_IS_PRODUCTION` | `true` = endpoint production Tripay. |
| `TRIPAY_QRIS_CHANNEL` / `TRIPAY_VA_CHANNEL` / `TRIPAY_EWALLET_CHANNEL` | Channel konkret per metode checkout; harus aktif di akun merchant. |
| `MIDTRANS_SERVER_KEY` / `MIDTRANS_CLIENT_KEY` / `MIDTRANS_IS_PRODUCTION` | Hanya untuk invoice lama + webhook legacy; lihat bagian Pembayaran. |

**Operasional**

| Key | Keterangan |
|---|---|
| `CRON_SECRET` | Bearer `GET /api/cron/sweep`; wajib di produksi. |
| `WA_BOT_TOKEN` / `WA_BOT_URL` / `WA_BOT_PORT` | Bot WhatsApp OTP (Baileys) di `127.0.0.1:3140`. Tanpa token, produksi menolak boot. |
| `WA_BOT_PAIRING_NUMBER` | Opsional: pairing code alih-alih scan QR. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Anti-bot di login/daftar. Set keduanya atau kosongkan keduanya. |
| `BLOG_API_TOKEN` | Bearer API blog otomasi. Kosong = endpoint 503 (fail closed). |

**Login & legal**

| Key | Keterangan |
|---|---|
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | OAuth Discord; kosong = tombolnya mati. Redirect: `${SITE_URL}/api/auth/callback/discord`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google; redirect: `${SITE_URL}/api/auth/callback/google`. |
| `LEGAL_OPERATOR_*` | Identitas operator di halaman legal. Dibaca per-request: edit `.env` + restart, tanpa build. |

Generate secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Produksi (PC ini = server)

| Komponen | Detail |
|---|---|
| Web | PM2 `bloxastra-web` → `next start -p 3132` |
| WhatsApp | PM2 `bloxastra-wa` → `wa-bot/bot.mjs`, loopback `127.0.0.1:3140`; scan QR sekali via `pm2 logs bloxastra-wa` |
| Tunnel | PM2 `bloxastra-tunnel` → `cloudflared tunnel run bloxastra` (ingress `bloxastra.com` + `www` → `127.0.0.1:3132`; tambahkan `blog.bloxastra.com` ke ingress agar blog hidup) |
| Boot | Scheduled Task `BloxAstraPM2` → `BloxAstraPm2Boot.ps1` saat **logon Administrator** (interactive, delay 30s). Jangan pakai boot trigger SYSTEM: daemon PM2-nya hidup di sesi lain. |
| Watchdog | Scheduled Task `BloxAstraPM2Watchdog` tiap 5 menit → cek ketiga app + `127.0.0.1:3132` + bloxastra.com, pulihkan sendiri |
| Sweep | Scheduled Task `BloxAstraSweep` (tiap 10 mnt) → `GET /api/cron/sweep` |
| Backup | Scheduled Task `BloxAstraBackup` (harian 03:00, SYSTEM) → `BloxAstraBackup.cjs` → `BloxAstraBackups/`, retensi 7 |
| Log | `logs/` + `pm2 logs` (rotasi via `pm2-logrotate`: 10MB × 7, compress) |

Perintah harian:

```bash
pm2 list                 # status semua proses
pm2 logs bloxastra-web   # log aplikasi (error = bug; lihat ronde audit)
pm2 restart bloxastra-web --update-env && pm2 save   # habis ganti .env (deploy pakai npm run deploy)
```

## Deploy checklist

1. `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm test` ✅
2. `npm run deploy` — build ke `.next-verify`, tukar `.next`, restart, lalu tunggu HTTP 200; gagal build/siap = rollback otomatis (lihat “Deploy”).
3. Verifikasi: `curl https://bloxastra.com/` → 200, klik 1 alur beli, cek pool seller.
4. Kalau ganti schema Prisma: `pm2 stop bloxastra-web` → matikan dev server → `npx prisma db push` (atau migrasi baru) + `generate` → `npm run deploy`. JANGAN `Stop-Process -Name node`: membunuh daemon PM2 + dev sekaligus.
5. Kalau hanya `.env` berubah: `pm2 restart bloxastra-web --update-env && pm2 save` (tanpa build).

## Backup & restore (sudah di-drill, lolos)

- Backup: otomatis harian 03:00, snapshot konsisten via `node:sqlite serialize()`, cek integritas tiap file, log di `logs/backup.log`.
- Restore: `node C:\Users\Administrator\BloxAstraRestore.cjs [nama-file]` — **wajib stop web dulu** (`pm2 stop bloxastra-web`), script otomatis salin live DB ke `pre-restore-*` dulu, lalu `integrity_check`, lalu start lagi. Rollback = copy file `pre-restore-*` balik.
- Jangan pernah restore tanpa safety copy. Jangan edit `bloxastra.db` manual saat web jalan.

## Pembayaran (Tripay)

`PAYMENT_PROVIDER=tripay` mengirim setiap invoice ke Tripay pada satu channel
konkret per metode checkout (`TRIPAY_QRIS_CHANNEL`, `TRIPAY_VA_CHANNEL`,
`TRIPAY_EWALLET_CHANNEL`). Channel itu harus aktif di akun merchant.

- Webhook: daftarkan `https://bloxastra.com/api/payments/tripay` (event
  `payment_status`). Signature = HMAC-SHA256(raw body, `TRIPAY_PRIVATE_KEY`),
  dibandingkan timing-safe sebelum apa pun diproses.
- Isi callback **bukan** sumber kebenaran: route membaca
  `GET /transaction/detail` dan memakai status + nominal dari Tripay.
- Order macet `pending_payment` padahal buyer sudah bayar → tombol “Saya sudah
  bayar — cek status” di ruang pesanan (Status Detail API, bukan menunggu webhook).
- `PAYMENT_PROVIDER=sim` untuk lokal; settle lewat `/bayar/sim`. Produksi
  menolak boot bila provider bukan `tripay`/`midtrans`.

### Invoice Midtrans lama

Kode Midtrans dipertahankan hanya agar invoice yang dibuat sebelum migrasi tetap
bisa dibayar dan callback-nya tetap diverifikasi (`/api/payments/midtrans`,
SHA-512 `order_id + status_code + gross_amount + server_key`). Bila masih ada
invoice seperti itu di produksi, **jangan hapus `MIDTRANS_SERVER_KEY`**: tanpa
key, webhook lama menjawab 503 dan settlement-nya tidak pernah masuk.
`MIDTRANS_*` tidak dipakai untuk order baru saat provider `tripay`.

### Checklist sebelum terima uang asli

1. `.env`: `PAYMENT_PROVIDER=tripay`, `TRIPAY_IS_PRODUCTION=true`, dan kunci
   production dari dashboard Tripay (bukan sandbox). Boot menolak bila kunci
   wajib kosong.
2. Dashboard Tripay **production**: webhook URL terpasang, channel QRIS/VA/
   e-wallet aktif, dan `TRIPAY_*_CHANNEL` menunjuk channel yang benar.
3. Uji 1 transaksi nominal terkecil sampai `paid` → klaim penjual → selesai;
   lalu uji satu invoice kedaluwarsa/refund.
4. Pastikan `CRON_SECRET` terpasang — tanpa sweep, auto-release dan refund
   otomatis tidak pernah jalan.

## Blog (subdomain + API otomasi)

- Publik: `https://blog.bloxastra.com` (index `/`, artikel `/<slug>`). Proxy
  me-301 `bloxastra.com/blog*` → subdomain, dan path milik toko di host blog
  dikembalikan ke situs utama. Artikel di-cache dengan tag `blog`.
- Menulis dari panel admin (`/admin?tab=blog`) atau dari mesin lewat
  `POST /api/blog/posts` dengan `Authorization: Bearer $BLOG_API_TOKEN`.
  Upsert per slug: retry memperbarui artikel yang sama, bukan membuat duplikat.
  `GET /api/blog/posts` untuk daftar, `GET /api/blog/topics` untuk bahan ide.
  Kontrak lengkap: [docs/hermes-blog-api.md](docs/hermes-blog-api.md).
- `BLOG_API_TOKEN` kosong = endpoint 503 (fail closed). Rate limit 1 request /
  2 detik per IP.
- `authorEmail` untuk tulisan mesin diisi nama operator
  (`BLOG_API_AUTHOR` di `src/lib/blog-api.ts`), bukan email; hanya terlihat di
  panel admin dan respons `GET /api/blog/posts`.
- Markdown di-escape lebih dulu lalu dirender dengan whitelist kecil
  (`src/lib/blog.ts`); HTML mentah tidak dieksekusi.

## Perimeter: CSP + WAF Cloudflare

- CSP berjalan **report-only** (`content-security-policy-report-only`, nonce per-request via `src/proxy.ts`). Pelanggaran masuk `logs/` PM2 dengan prefix `[csp]`.
- Nonce dikirim di **request header** dan response header. Next tidak membaca `x-nonce` sama sekali; ia mengambil nonce dengan mengurai header CSP pada request yang masuk (`next/dist/server/route-modules/app-page/parse-request-headers.js`, yang membaca `content-security-policy` lalu `…-report-only`). Tanpa header itu, skrip framework dirender tanpa nonce dan tiap satunya dilaporkan sebagai pelanggaran.
- **Jangan enforce selama `cacheComponents` (PPR) menyala.** Diukur 2026-10-12 pada build produksi: tiga skrip inline tetap tanpa nonce — `requestAnimationFrame(…$RT…)`, `$RB/$RV` (skrip pembuka shell PPR), dan `_R_` (daftar chunk Turbopack). Ketiganya ditulis saat build, jadi nonce per-request tidak bisa menempelinya; `_R_` lagi memuat nama chunk yang berubah tiap build, jadi hash statis juga tidak bisa dipakai. Enforce = shell PPR tidak pernah terbuka dan isi halaman ikut hilang. Dua jalan bila memang mau enforce: matikan PPR untuk rute terkait (nonce menempel ke semua skrip saat render dinamis), atau terima tiga skrip itu sebagai pengecualian permanen dan tetap report-only.
- Rencana lama "setelah 1 minggu log bersih, ganti ke enforce" tidak bisa tercapai selama tiga skrip di atas ada — lognya tidak akan pernah bersih, jadi jangan menunggu sinyal itu.
- WAF Cloudflare (dashboard, tanpa kode):
  1. Rate limit `POST /api/payments/tripay` (dan `/api/payments/midtrans` legacy): >30 req/mnt per IP → block 10 mnt.
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
- Migrasi Prisma masih satu baseline (`prisma/migrations/00000000000000_baseline`).
  Perubahan skema berikutnya wajib dibuat sebagai migrasi baru sebelum dipakai
  di environment lain — jangan hanya mengandalkan `db push`.
- Notifikasi transaksi hanya inbox aplikasi + webhook Discord seller. WhatsApp
  (`wa-bot`) hanya dipakai untuk OTP verifikasi profil, bukan notifikasi order.

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
