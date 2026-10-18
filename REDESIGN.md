# BloxAstra: arah desain ulang dan rencana bertahap

> **Catatan pivot.** Tema yang dijelaskan di bawah ini TERANG; tema yang berjalan
> sekarang GELAP. Setelah tema terang selesai, penilaiannya terlalu terasa seperti
> template SaaS dan nuansa gamenya hilang, jadi arahnya diputar ke lobi gelap ala
> Roblox. Yang tetap berlaku dari dokumen ini: disiplin token, batas jumlah hue,
> dan standar copy. Yang berubah: semua nilai warna, arah kedalaman (panel kini
> terangkat di atas lantai gelap, bukan lembar putih di atas putih), dan bentuk
> kontrol. Rincian tema gelap ada di blok token `src/app/globals.css` — di situlah
> kebenarannya, karena dokumen ini tidak lagi merinci setiap nilai.

Dokumen keputusan. Pilih satu arah di bagian "Tiga arah", lalu kerjakan fase di bagian "Rencana". Tidak ada kode yang berubah sebelum arah dipilih.

## Keadaan sekarang

Angka hasil audit, bukan perkiraan.

| Bagian | Jumlah |
|---|---|
| Rute (`page.tsx`) | 26 |
| Baris komponen (`src/components/**`) | 16.123 |
| Komponen terberat | `src/components/order` 4.645 baris, `src/components/seller` 2.076, `src/components/ui` 1.565 |
| Token warna/huruf/gerak di `src/app/globals.css` | 47 |
| `@utility` kustom | 9 |
| Em dash di komponen `.tsx` | 148 |

Yang sudah benar dan sebaiknya dipertahankan: kanvas terang dengan satu aksen, `num` sebagai monospace angka tabular (kode pesanan, rupiah, tanggal), kartu `bezel-shell` yang datar, dan reveal scroll CSS-only yang tidak menyembunyikan konten saat JS gagal.

Utang yang perlu dibereskan apa pun arah yang dipilih:

- Alias lama masih dipakai bersamaan dengan nama baru: `void`, `abyss`, `surface`, `surface-2`, `surface-3`, `hairline`, `hairline-strong`.
- Radius bercampur: `rounded-2xl`, `rounded-3xl`, `rounded-[1.6rem]`, `rounded-full` di konteks yang sama.
- `accent-text` menumpuk tiga warna (rose, pink, amber) di satu judul.
- 148 em dash tersebar di copy komponen.

## Tiga arah

Semua arah memakai tumpukan yang sudah ada (Next.js App Router, Tailwind v4 `@theme`, Plus Jakarta Sans, ikon SVG sendiri). Tidak ada dependensi UI baru di ketiganya.

### Arah A: Terang Editorial (risiko paling kecil)

Merapikan sistem yang ada sampai konsisten, bukan mengganti identitas.

- Warna: kanvas `#ffffff`, well `#f6f7f9`, hairline `#e6e8ec`, ink `#14161a`, ink-dim `#565c66`, aksen `#d61f45`, teks aksen `#a5122f`.
- Huruf: display Plus Jakarta Sans 800 dengan tracking `-0.035em`, body 15px/1.55, label 10–11px uppercase tracking `0.16em`, angka pakai `num`.
- Grid: konten maks 1180px, gutter 16/32, ritme 4px, satu radius untuk kartu (20px) dan satu untuk kontrol (12px).
- Permukaan: satu bentuk kartu, hairline 1px, tanpa bayangan. Gradien hanya di strip promo.
- Gerak: transisi 150–200ms, reveal scroll seperti sekarang, tanpa parallax.
- Perubahan terbesar: alias lama dihapus, radius disatukan, `accent-text` tri-tone dibuang, skala huruf ditata ulang (3 ukuran judul, 3 ukuran body).
- Yang perlu diwaspadai: kalau dikerjakan setengah hati, hasilnya terbaca sebagai polesan biasa.

### Arah B: Gelap Gaming (perubahan paling terasa)

- Warna: kanvas `#0b0c10`, well `#14161c`, hairline `rgba(255,255,255,0.08)`, ink `#f4f5f7`, ink-dim `#a2a8b4`, aksen `#ff2d55`, teks aksen `#ff5c7c`, warn `#ff9f0a`, danger `#ff453a`.
- Huruf: display tetap Plus Jakarta Sans 800, ukuran judul halaman 2.75–3.25rem, body 15px, lencana dan angka monospace.
- Permukaan: kartu gelap dengan hairline tipis, tanpa bayangan. Glow hanya untuk status hidup (pill live, escrow ditahan, sengketa).
- Gerak: hover naik 2px, shimmer untuk loading, tanpa animasi latar.
- Perubahan terbesar: seluruh 26 rute pindah ke tema gelap, termasuk ruang pesanan dan panel admin.
- Yang perlu diwaspadai: kontras harus diuji satu per satu (badge, stepper, tabel admin). Gambar QRIS/VA dari gateway biasanya berlatar putih dan akan terlihat sebagai kotak putih, jadi perlu dibingkai di dalam kartu terang.
- Perlu dicek: nilai kontras `#ff5c7c` di atas `#14161c` (target AA untuk teks kecil), serta tampilan `<select>` bawaan di Windows yang tetap dirender sistem.

### Arah C: Ledger Industrial

- Warna: kanvas `#f4f4f1`, permukaan `#ffffff`, rule `#d8d8d2`, ink `#111111`, aksen `#c81e3c`. Warna fungsional hanya untuk status.
- Huruf: display grotesk tebal tracking rapat, label dan angka monospace, label 10–11px uppercase.
- Grid: pemisah antar baris memakai hairline, bukan kartu mengambang. Hierarki dibawa skala huruf, bukan bayangan.
- Gerak: minimal, 120ms, tanpa reveal.
- Cocok untuk area kerja penjual dan admin. Kurang pas untuk landing yang perlu menjual, jadi landing butuh perlakuan terpisah (hero besar, satu gambar produk, tanpa tabel).

## Keputusan

Arah yang dipilih: **A, Terang Editorial**. Nilai yang dikunci di `src/app/globals.css`:

> Tabel di bawah adalah keputusan fase 1 dengan aksen krimson. Setelah itu identitasnya diganti ke **Terang Elektrik** (violet, Sora + Manrope); nilai yang berlaku sekarang ada di bagian "Perubahan tema". Tabel ini tetap disimpan sebagai jejak keputusan.

| Token | Nilai | Catatan |
|---|---|---|
| `--color-paper` / `--color-canvas` / `--color-canvas-2` | `#ffffff` / `#f6f7f9` / `#eef0f3` | well abu netral, bukan slate kebiruan |
| `--color-line` / `--color-line-strong` | `#e6e8ec` / `#cfd3da` | |
| `--color-ink` / `--color-ink-dim` / `--color-ink-mute` | `#14161a` / `#565c66` / `#6b7280` | `ink-mute` 4.8:1 di atas putih, teks terkecil yang boleh dipakai untuk 11px |
| `--color-astra` / `--color-astra-ink` | `#d61f45` / `#a5122f` | putih di atas `astra` 5.1:1, `astra-ink` di atas putih 7.7:1 |
| `--radius-card` / `--radius-well` / `--radius-control` | `20px` / `14px` / `12px` | tiga nilai saja, jangan ada `rounded-[1.4rem]` baru |

Aturan turunannya: tombol dan input memakai `rounded-control`, kartu `bezel-shell` memakai `radius-card`, blok dalam `bezel-core` memakai `radius-well`. Gradien hanya untuk `accent-wash` di strip promo; `accent-fill` menggantikan `accent-gradient` sebagai isi solid, dan `accent-text` sekarang satu warna krimson tanpa `background-clip`.

Catatan operasional: Next 16 menulis keluaran dev ke `.next/dev`, jadi `next dev` dan `next build` boleh jalan bersamaan tanpa saling menimpa. Set `NEXT_DIST_DIR` hanya perlu kalau mau build sekali pakai di samping `.next` yang sedang dilayani produksi, misalnya `NEXT_DIST_DIR=.next-verify npm run build`.

## Hasil Fase 1

Delapan file berubah dan semuanya sudah lulus verifikasi.

- `src/app/globals.css`: palet dan radius baru, `accent-fall` serta `text-balance-tight` dibuang karena tidak pernah dipakai, slider range tidak lagi menyimpan nilai krimson lama secara hardcode.
- `src/components/ui/button.tsx`: `rounded-full` menjadi `rounded-control`, varian primary jadi isi solid tanpa bayangan dan tanpa gradien.
- `src/components/ui/field.tsx`, `feedback.tsx`, `surface.tsx`: radius diseragamkan, `bg-surface-2` (alias lama) menjadi `bg-canvas-2`.
- `src/components/landing/{hero,premium-plans,robux-packs}.tsx`: `accent-gradient` menjadi `accent-fill`, radius CTA disamakan.

Yang belum disentuh dan memang jatah fase berikutnya: skala huruf display, 146 `rounded-2xl` di dalam rute, 41 `rounded-3xl`, dan 148 em dash.

## Hasil Fase 2 sampai 4 (warna, radius, huruf)

106 berkas berubah, +1108/−1069 baris (angka dari `git diff --shortstat`; dokumen ini tidak dihitung karena belum dilacak git). Angka di bawah diukur dari working tree, bukan perkiraan.

| Ukuran | Sebelum | Sesudah |
|---|---|---|---|
| Warna skala Tailwind bawaan (`slate`, `rose`, `emerald`, `amber`, `sky`, `violet`) | ~300 pemakaian, termasuk 69 `#E11D48` hardcode | 0 di komponen; sisa `#5865F2` hanya di path logo Discord |
| Alias token lama (`surface`, `surface-2`, `hairline`, `void`) | 49 | 0 |
| `rounded-2xl` / `rounded-3xl` / `rounded-[1.5rem]` / `rounded-[1.4rem]` | 213 | 0 |
| Kelas rusak hasil migrasi (`bg-success/[0.06]0/10`, `border-info/25/80`, `outline-slate-200`) | 12 | 0 |
| Baris dengan em dash di teks yang tampil | 182 | 20, semuanya penanda data kosong (13), pesan developer berbahasa Inggris (5), dan komentar kode (2) |

Yang tidak lagi dipakai: gradien tiga warna lama di judul, chip kaki halaman "Kredensial AES-256-GCM" (jargon diganti "Kredensial pesanan dienkripsi"), dan klise "Stok yang paling sering dicari minggu ini".

## Hasil Fase 5 (audit dan perbaikan)

Tiga temuan nyata, semuanya diperbaiki di akarnya.

1. `/pesanan/[code]` gagal prerender: `cookies()` dan `Date.now()` terbaca sebelum rute keluar dari prerender, sehingga halaman melempar error di overlay dev dan berpotensi gagal saat build. `await connection()` dipindah ke baris pertama `OrderDetailContent` dan `generateMetadata`, mengikuti pola yang sudah dipakai `/admin` dan `/beli/*`. Log dev untuk rute ini sekarang nol error.
2. Halaman masuk: kolom kiri hanya memakai 340px dari 690px tinggi kartu. Sekarang isinya di tengah vertikal, notifikasi duplikat di dalam formulir dibuang, tombol OAuth memakai `rounded-control` dan hover token sendiri, dan judul "Dana kamu dijaga sistem, bukan dijaga keberuntungan" diganti klaim mekanisme: "Dana berpindah setelah barang kamu terima."
3. Dompet: kartu saldo dibiarkan menggantung dengan ruang kosong di bawah nominal, dan teks top-up tetap bilang "siap dipakai" saat saldo minus. Sekarang kartu memakai `h-full` dengan isi terdistribusi, saldo minus memunculkan peringatan bahwa checkout Saldo Akun tertahan, dan teks top-up berubah sesuai saldo.

Verifikasi pada keadaan berkas terakhir: `npx tsc --noEmit` exit 0, `npm run lint` exit 0, `npm test` 62/62 lulus, `NEXT_DIST_DIR=.next-verify npm run build` exit 0 dengan 37 rute.

## Perubahan tema: Terang Elektrik

Permintaan lanjutan setelah audit: ganti tema, bukan cuma rapikan. Karena semua warna dan radius sudah dinormalisasi ke token di fase 2 sampai 5, penggantiannya cukup satu blok `@theme` di `src/app/globals.css` plus perbaikan bertarget, bukan migrasi ulang 107 berkas.

| Bagian | Terang Editorial (sebelum) | Terang Elektrik (sekarang) |
|---|---|---|
| Kanvas / well | `#ffffff` / `#f6f7f9` / `#eef0f3` | `#ffffff` / `#f7f7fc` / `#eeeef8` (sejuk, sedikit lavender) |
| Hairline | `#e6e8ec` / `#cfd3da` | `#e7e7f2` / `#d2d2e4` |
| Ink | `#14161a` / `#565c66` / `#6b7280` | `#17152e` / `#55536f` / `#6b6889` |
| Aksen | krimson `#d61f45`, teks `#a5122f` | violet `#6d3bf5`, teks aman `#5b21b6`, wash `#f3f0ff`, mint `#e4dcff` |
| Huruf | Plus Jakarta Sans untuk semua | Sora untuk judul (600/700/800), Manrope untuk badan, monospace sistem untuk `num` |
| Info | biru | teal `#0e7490` |
| Gerak | 150-200ms tanpa token | 3 durasi (`140/220/420ms`) dan 3 kurva, plus `pop`, `rise`, `sheen`, `marquee`, `breathe`, `orbit`, `shimmer` |

Alasan tiap pilihan yang tidak jelas dari angkanya:

- `info` dipindah dari biru ke teal karena di sebelah aksen violet, biru terbaca sebagai warna merek kedua; teal terbaca sebagai status.
- `num` sebelumnya dialiaskan ke Plus Jakarta Sans, jadi token monospace-nya tidak melakukan apa pun dan setiap nominal rupiah ikut berganti huruf saat font body diganti. Sekarang memakai tumpukan monospace sistem, jadi tidak ada unduhan tambahan.
- Duotone ilustrasi (`src/components/ui/art.tsx`) diarahkan ulang ke keluarga violet plus emas Robux; lima pasang tetap cukup gelap untuk glyph putih di atasnya.
- Gradien tetap hanya di strip promo. Semua permukaan lain isi solid, hairline 1px, tanpa bayangan.

Verifikasi kontras dijalankan dengan `node tools/contrast.mjs` (skrip di repo, bukan penilaian mata): 20 dari 20 pasangan lolos, termasuk `putih di atas astra` 5.84:1, `ink-mute` di `canvas-2` 4.59:1, dan `line-strong` vs paper 1.49:1 untuk batas non-teks.

### Temuan dan perbaikan

1. Track slider harga di `/katalog` tidak terlihat: kelasnya `bg-canvas` (`#f7f7fc`) di atas paper putih, jadi hanya ibu jari yang tampak. Sekarang memakai `smooth-range-slider` yang sama dengan slider Robux, dengan isi violet sampai nilai terpilih dan sisa `line-strong`. Tiga slider di `robux-{login,username,gamepass}-order.tsx` ikut naik dari `line` ke `line-strong` supaya sisa track-nya juga terbaca, bukan cuma bagian yang terisi.
2. Audit DOM (bukan tangkapan layar) di 13 rute: `/`, `/katalog`, `/produk/[slug]`, `/checkout`, `/masuk`, `/profil`, `/notifikasi`, `/admin`, `/dashboard/admin`, `/dashboard/penjual`, `/dashboard/penjual/dompet`, `/dashboard/penjual/listing`, `/pesanan/[code]`. Skripnya menghitung kontras setiap teks terhadap latar efektifnya (naik ke leluhur, lewati latar bergradien), lalu memeriksa luapan horizontal. Hasil: nol temuan kontras nyata, nol luapan dokumen. Yang muncul sebagai temuan palsu dan sudah diverifikasi manual: teks putih di pil `bg-astra` yang latarnya ditulis anak `absolute -z-10` (5.84:1), chip di atas artwork yang latarnya `bg-paper/90` dan terbaca Chromium sebagai `oklab(...)` (kini ditangani skripnya), dan pil navigasi di header `bg-paper/80 backdrop-blur-xl`.
3. Percobaan `curl` ke 23 rute: semua 200, kecuali `/dashboard/pembeli` dan `/promo` yang memang bukan rute (tidak ada berkas, tidak ada tautan masuk). Direktori kosong `src/app/dashboard/pembeli/` masih ada dan tidak menghasilkan rute apa pun; aman dihapus kalau memang tidak direncanakan.

### Perkakas verifikasi

Tiga skrip di `tools/` dibuat untuk memeriksa tema tanpa menyentuh data asli. Semuanya dijalankan dengan `DATABASE_URL` eksplisit dan tidak dipakai oleh aplikasi.

- `prepare-verify-db.mjs`: menyalakan semua produk dan toko di DB salinan saja, supaya halaman yang butuh listing aktif bisa dibuka.
- `activate-admin-seller.mjs`: memberi akun admin profil penjual di DB salinan, supaya `/dashboard/penjual` bisa dinilai sebagai pemilik toko.
- `contrast.mjs`: menghitung rasio kontras pasangan token tema beserta ambang WCAG yang dituntut masing-masing pasangan.

### Keadaan verifikasi terakhir

`npx tsc --noEmit` exit 0, `npx eslint .` exit 0, `npm test` 62/62 lulus, `NEXT_DIST_DIR=.next-verify npm run build` exit 0 dengan 37 rute. Working tree: 107 berkas berubah, +1238/−1092. Belum di-commit.

## Rencana

Setiap fase berakhir dengan commit sendiri, dan setiap fase lulus `npx tsc --noEmit`, `npm run lint`, `npm test`, `NEXT_DIST_DIR=.next-verify npm run build`. Rute yang disentuh dibuka di browser dan dibandingkan dengan tangkapan layar sebelumnya. Production di port 3132 tidak disentuh sampai kamu memutuskan `pm2 restart`.

**Fase 0: baseline dan keputusan (setengah hari)**

1. Pilih arah, lalu tulis nilai finalnya (warna, huruf, radius, durasi gerak) ke satu bagian di dokumen ini.
2. Simpan tangkapan layar 26 rute sebagai pembanding sebelum perubahan.
3. Tandai zona beku: `checkout`, `pesanan/[code]`, `bayar/sim`, `dompet`, dan `/api/payments/midtrans`. Di rute ini desain boleh berubah, alur dan nama field tidak.
4. Baca `node_modules/next/dist/docs/` untuk API yang akan dipakai, sesuai catatan di `AGENTS.md`.

**Fase 1: fondasi (token dan primitif)**

1. `src/app/globals.css`: ganti blok `@theme`, tambah token jarak dan radius, sisakan satu `@utility` untuk kartu.
2. `src/components/ui`: `button`, `badge`, `field`, `feedback`, `surface`, `icons` diseragamkan ukuran, radius, dan state fokus.
3. Tidak ada rute yang diubah. Yang diverifikasi: katalog dan satu formulir (masuk atau daftar) sebagai contoh render.

**Fase 2: funnel publik**

`/` (landing), `/katalog`, `/produk/[slug]`, `/checkout`, `/bayar/sim`, `/beli/*`. Ini bagian yang paling sering dilihat pembeli dan yang menentukan konversi.

**Fase 3: ruang pesanan dan akun**

`/pesanan`, `/pesanan/[code]` beserta limbah komponen di `src/components/order` (4.645 baris: chat, stepper, sengketa, review), `/notifikasi`, `/profil`, `/masuk`, `/daftar`.

**Fase 4: dashboard penjual, admin, dan dompet**

`/dashboard/penjual/*` (5 rute), `/dashboard/admin`, `/admin`, `/dompet`, plus `src/components/wallet` dan `src/components/rates`.

**Fase 5: pembersihan dan pengukuran**

1. Hapus alias token lama setelah pemakaian terakhir bermigrasi.
2. Audit kontras ke WCAG AA untuk teks kecil, state fokus, dan badge status.
3. Audit copy pakai aturan di bagian berikut, termasuk 148 em dash.
4. Ukur ulang: jumlah rute tanpa temuan kontras, ukuran CSS hasil build sebelum dan sesudah, dan waktu muat `/katalog` sebelum dan sesudah.

## Standar copy untuk desain ulang

Setiap teks yang ditulis atau disentuh mengikuti aturan ini.

- Kata yang tidak dipakai: delve, foster, leverage, utilize, facilitate, empower, streamline, robust, cutting-edge, paradigm shift, game changer, tapestry, realm, beacon, multifaceted, meticulous, intricate, paramount, transformative, elevate, embark, supercharge, harness, ever-evolving.
- Em dash bukan alat ritme. Maksimal satu per halaman panjang, nol di tombol dan label.
- Tanpa pola "bukan X, tapi Y", tanpa pembuka pengantar ("Perlu diketahui", "Yang penting"), tanpa setup pujian diri ("Yang sering dilewatkan penjual"), tanpa penutup yang merangkum ulang.
- Klaim diganti angka atau mekanisme. "Dana cair cepat" menjadi "Dana cair setelah pembeli konfirmasi atau jendela auto-release habis (sweep tiap 10 menit)".
- Klaim tanpa implementasi tidak ditulis di UI. Catat di README seperti bagian "Janji tanpa implementasi" yang sudah ada.

Hasil pemindaian copy situs saat ini: nol kata terlarang berbahasa Inggris, satu klise Indonesia (`Stok yang paling sering dicari minggu ini` di `src/components/landing/featured-listings.tsx:32`), dan 148 em dash.

## Yang tidak masuk lingkup

- Perubahan alur, skema database, atau kontrak API.
- Sistem notifikasi email/WhatsApp (infra belum ada).
- Kode Roblox di `../catalog-system`, `../roblox`, dan `../plot-system`. Repository GitHub `BloxAstra` hanya berisi situs.
