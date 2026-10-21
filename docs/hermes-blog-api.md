# Blog API — otomasi artikel (Hermes agent)

Endpoint mesin untuk membuat/memperbarui artikel blog tanpa panel admin.
Semua permintaan memakai **Bearer token** (`BLOG_API_TOKEN` di `.env` server).

- Base URL: `https://bloxastra.com`
- Auth: `Authorization: Bearer <BLOG_API_TOKEN>`
- Format: JSON (`Content-Type: application/json`)
- Penulis artikel otomasi tercatat sebagai **Ahmad Syaukani** (kolom jejak `authorEmail`; tidak ditampilkan ke pembaca).
- Rate limit: 1 permintaan per 2 detik per IP → di luar itu `429`.

## 1. Buat / perbarui artikel — `POST /api/blog/posts`

**Upsert per `slug`**: `slug` yang sudah ada akan **diperbarui**, bukan dibuat duplikat.
Aman di-retry. `status` default `published` (langsung tampil di `/blog`).

```bash
curl -X POST https://bloxastra.com/api/blog/posts \
  -H "Authorization: Bearer $BLOG_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cara Aman Beli Item Blox Fruits",
    "content": "## Pendahuluan\n\nIsi artikel dalam **markdown**...\n\n- poin satu\n- poin dua",
    "excerpt": "Ringkasan 1-2 kalimat untuk kartu blog dan meta description.",
    "tags": ["blox-fruits", "panduan", "keamanan"],
    "coverImage": "https://example.com/gambar.jpg",
    "status": "published"
  }'
```

| Field | Wajib | Catatan |
|---|---|---|
| `title` | ya | maks 140 karakter |
| `content` | ya | markdown, maks 60.000 karakter; `published` wajib ada isi |
| `slug` | tidak | kosong ⇒ diturunkan dari `title`; huruf kecil + tanda hubung |
| `excerpt` | tidak | maks 300; kosong ⇒ diambil otomatis dari `content` |
| `tags` | tidak | array (maks 6, tiap tag maks 28) atau string dipisah koma |
| `coverImage` | tidak | URL `https` (atau data-URL gambar < 800 KB) |
| `status` | tidak | `published` (default) atau `draft` |

Respons:

```json
{ "ok": true, "id": "cuid...", "slug": "cara-aman-beli-item-blox-fruits",
  "url": "/blog/cara-aman-beli-item-blox-fruits", "created": true, "author": "Ahmad Syaukani" }
```

Status: `201` dibuat · `200` diperbarui · `400` input tidak valid · `401` token salah ·
`409` slug dipakai artikel lain (hanya bila mengirim `id`) · `429` terlalu cepat · `503` token belum diset di server.

## 2. Daftar artikel — `GET /api/blog/posts`

Cek dulu sebelum menulis, supaya tidak menulis artikel duplikat.

```bash
curl -H "Authorization: Bearer $BLOG_API_TOKEN" \
  "https://bloxastra.com/api/blog/posts?status=published&limit=50"
```

Query: `status=published|draft`, `limit=1..200` (default 50), `q=<teks>` (cari di judul/slug).

```json
{ "ok": true, "count": 1, "posts": [
  { "id": "...", "slug": "...", "url": "/blog/...", "title": "...", "excerpt": "...",
    "tags": ["..."], "status": "published", "publishedAt": "2026-10-18T17:59:05.148Z",
    "author": "Ahmad Syaukani", "updatedAt": "2026-10-18T17:59:05.148Z" } ] }
```

## 3. Bahan ide artikel — `GET /api/blog/topics`

Isi katalog nyata + semua judul/slug/tag yang **sudah** dipakai, untuk memilih topik yang belum dibahas.

```bash
curl -H "Authorization: Bearer $BLOG_API_TOKEN" https://bloxastra.com/api/blog/topics
```

```json
{ "ok": true,
  "catalogue": { "categories": [{ "slug": "gamepass", "name": "Gamepass", "tagline": "...", "slaMinutes": 15 }],
                 "games": [{ "game": "Blox Fruits", "listedProducts": 12 }] },
  "blog": { "total": 1, "published": 1, "drafts": 0,
            "titles": ["Top Up Robux Instan ..."], "slugs": ["top-up-robux-instan-..."],
            "tagsUsed": ["robux", "top-up"] } }
```

## Catatan

- Artikel yang diterbitkan langsung membatalkan cache `/blog` dan `/blog/<slug>`; tampil seketika.
- `publishedAt` diisi saat pertama kali terbit dan **tidak** berubah saat artikel lama disunting (tidak melompat ke atas `/blog`).
- Markdown: judul, tebal/miring, tautan, daftar, blok kode, kutipan. HTML mentah tidak dirender (di-escape).
- Setiap tulisan tercatat di `AdminAuditLog` (`actor` + `ipAddress`), jadi asal-usul artikel bisa dilacak.
- Ganti token: ubah `BLOG_API_TOKEN` di `.env` lalu `pm2 restart bloxastra-web`.
