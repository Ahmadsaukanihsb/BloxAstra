/**
 * Seed the database with the demo catalogue, sellers, orders, wallet ledger
 * and admin audit rows that used to live in src/lib/mock.ts.
 *
 * Run with:  npm run db:seed
 * Safe to re-run â€” it wipes and rewrites every seeded table.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { listingQuote } from "../src/lib/robux-pricing";
import { formatNumber, gamepassPriceForNet } from "../src/lib/format";

const prisma = new PrismaClient();

const gamepassValue = (netRobux: number) => formatNumber(gamepassPriceForNet(netRobux));

/** Slug â†’ { featured, sortOrder } for the home-page shelves. */
const productCuration: Record<string, { featured?: boolean; sortOrder?: number; shelf?: string }> = {
  // Featured home shelf.
  "robux-1000-bersih-cover-tax-gamepass": { featured: true, sortOrder: 1, shelf: "pack" },
  "blox-fruits-permanent-dough": { featured: true, sortOrder: 3, shelf: "limited" },
  "roblox-premium-450-per-bulan": { featured: true, sortOrder: 4, shelf: "service" },
  // Robux packs shelf (landing "RobuxPacks").
  "robux-500-bersih-cover-tax": { sortOrder: 11, shelf: "pack" },
  "robux-2000-bersih-cover-tax": { sortOrder: 10, shelf: "pack" },
  "robux-5000-bersih-cover-tax": { sortOrder: 15, shelf: "pack" },
  "robux-10000-bersih-cover-tax": { sortOrder: 16, shelf: "pack" },
  // Limited collection shelf (landing "LimitedRedeem").
  "blox-fruits-permanent-kitsune": { sortOrder: 12, shelf: "limited" },
  "pet-simulator-99-huge-hellish": { sortOrder: 14, shelf: "limited" },
  "anime-vanguards-secret-unit": { sortOrder: 17, shelf: "limited" },
  // Service rail (landing "ServiceRail").
  "grow-a-garden-moonlit-seed-pack": { sortOrder: 20, shelf: "service" },
  "akun-roblox-starter-2019": { sortOrder: 21, shelf: "service" },
  "steal-a-brainrot-sahur-tier": { sortOrder: 23, shelf: "service" },
  // Redeem shelf (landing "LimitedRedeem" right column).
  "gift-card-roblox-10-usd": { featured: true, sortOrder: 2, shelf: "redeem" },
  "gift-card-roblox-50-usd": { sortOrder: 24, shelf: "redeem" },
  "gift-card-roblox-100-usd": { sortOrder: 25, shelf: "redeem" },
  "gift-card-roblox-25-usd": { sortOrder: 13, shelf: "redeem" },
};

async function main() {
  // Guard rail: this script deletes every table it touches. Pointed at the
  // production DATABASE_URL it would wipe users, orders, ledger and audit rows,
  // so it refuses a non-local database unless explicitly forced.
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const isLocal = /(^|\/\/)(file:|localhost|127\.0\.0\.1)/.test(databaseUrl);
  if (!isLocal && process.env.SEED_ALLOW_REMOTE !== "yes") {
    throw new Error(
      "Refusing to run the demo seed against a non-local DATABASE_URL. " +
        "Set SEED_ALLOW_REMOTE=yes only for a scratch database.",
    );
  }
  console.log("Seeding BloxAstra â€¦");

  // â”€â”€ wipe (reverse dependency order) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.adminAuditLog.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.walletLedger.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.message.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.order.deleteMany();
  await prisma.promoCode.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.product.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();

  // â”€â”€ categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const categories = [
    {
      slug: "gamepass",
      name: "Gamepass",
      tagline: "Robux masuk lewat gamepass buatanmu sendiri",
      fulfillment: "Auto-validation + kalkulator pajak 30%",
      slaMinutes: 15,
      taxCoverSupported: true,
      autoDelivery: false,
      commissionPercent: 4.5,
    },
    {
      slug: "item",
      name: "Item In-Game",
      tagline: "Trade langsung di server, dipandu chat pesanan",
      fulfillment: "Live-chat terkoordinasi + private server",
      slaMinutes: 45,
      taxCoverSupported: false,
      autoDelivery: false,
      commissionPercent: 6,
    },
    {
      slug: "gift",
      name: "Gift In-Game",
      tagline: "Item dikirim lewat fitur gift ke username kamu",
      fulfillment: "Instant delivery kode & gift",
      slaMinutes: 15,
      taxCoverSupported: false,
      autoDelivery: true,
      commissionPercent: 5,
    },
    {
      slug: "akun",
      name: "Akun Roblox",
      tagline: "Serah terima kredensial dengan wizard berjenjang",
      fulfillment: "Wizard serah terima 5 langkah",
      slaMinutes: 60,
      taxCoverSupported: false,
      autoDelivery: false,
      commissionPercent: 8,
    },
    {
      slug: "premium",
      name: "Roblox Premium",
      tagline: "Langganan Premium dibayarkan dari dalam akunmu",
      fulfillment: "Login sharing + kunci Parental PIN",
      slaMinutes: 30,
      taxCoverSupported: false,
      autoDelivery: false,
      commissionPercent: 8,
    },
  ];
  await prisma.category.createMany({ data: categories });
  console.log(`  categories: ${categories.length}`);

  // â”€â”€ users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const password = await bcrypt.hash("demo1234", 10);
  const adminHash = await bcrypt.hash("astra1234", 10);

  await prisma.user.create({
    data: {
      email: "admin@bloxastra",
      username: "admin",
      passwordHash: adminHash,
      role: "admin",
    },
  });

  const buyer = await prisma.user.create({
    data: {
      email: "pembeli@bloxastra",
      username: "pembeli_demo",
      passwordHash: password,
      role: "buyer",
      whatsapp: "081234567890",
    },
  });

  // seller users + profiles
  const sellerDefs = [
    {
      id: "slr-01",
      email: "slr01@bloxastra",
      username: "vaultnusantara",
      storeName: "VaultNusantara",
      handle: "vaultnusantara",
      tier: 3,
      isOnline: true,
      hasExpressBadge: true,
      avgDeliverySeconds: 214,
      rating: 4.94,
      reviewCount: 3128,
      ordersCompleted: 7412,
      disputeRatePercent: 0.21,
      joinedOn: new Date("2024-02-11"),
      city: "Bandung",
      kycVerified: true,
      bio: "Fokus stok Robux dan item Blox Fruits. Online rata-rata 14 jam sehari.",
    },
    {
      id: "slr-02",
      email: "slr02@bloxastra",
      username: "rubiselatan",
      storeName: "Rubi Selatan",
      handle: "rubiselatan",
      tier: 3,
      isOnline: true,
      hasExpressBadge: true,
      avgDeliverySeconds: 388,
      rating: 4.89,
      reviewCount: 2044,
      ordersCompleted: 5197,
      disputeRatePercent: 0.44,
      joinedOn: new Date("2023-11-02"),
      city: "Makassar",
      kycVerified: true,
      bio: "Spesialis Gift Card dan voucher digital. Kirim otomatis 24 jam.",
    },
    {
      id: "slr-03",
      email: "slr03@bloxastra",
      username: "arkadia",
      storeName: "Arkadia Game Store",
      handle: "arkadia",
      tier: 2,
      isOnline: true,
      hasExpressBadge: false,
      avgDeliverySeconds: 742,
      rating: 4.81,
      reviewCount: 918,
      ordersCompleted: 1873,
      disputeRatePercent: 0.72,
      joinedOn: new Date("2025-01-19"),
      city: "Surabaya",
      kycVerified: true,
      bio: "Stok item Pet Simulator 99 dan Anime Vanguards diperbarui tiap malam.",
    },
    {
      id: "slr-04",
      email: "slr04@bloxastra",
      username: "kiranablox",
      storeName: "Kirana Blox",
      handle: "kiranablox",
      tier: 2,
      isOnline: false,
      hasExpressBadge: false,
      avgDeliverySeconds: 966,
      rating: 4.76,
      reviewCount: 402,
      ordersCompleted: 611,
      disputeRatePercent: 0.94,
      joinedOn: new Date("2025-03-08"),
      city: "Yogyakarta",
      kycVerified: true,
      bio: "Akun Roblox siap pakai dengan riwayat bersih, semua bergaransi serah terima.",
    },
    {
      id: "slr-05",
      email: "slr05@bloxastra",
      username: "bloxsenja",
      storeName: "Blox Senja",
      handle: "bloxsenja",
      tier: 1,
      isOnline: true,
      hasExpressBadge: false,
      avgDeliverySeconds: 1490,
      rating: 4.62,
      reviewCount: 118,
      ordersCompleted: 147,
      disputeRatePercent: 0,
      joinedOn: new Date("2026-08-02"),
      city: "Medan",
      kycVerified: true,
      bio: "Toko baru, harga paling ramah untuk pembelian Robux kecil.",
    },
    {
      id: "slr-06",
      email: "slr06@bloxastra",
      username: "tirtadigital",
      storeName: "Tirta Digital",
      handle: "tirtadigital",
      tier: 3,
      isOnline: true,
      hasExpressBadge: true,
      avgDeliverySeconds: 176,
      rating: 4.97,
      reviewCount: 5580,
      ordersCompleted: 12940,
      disputeRatePercent: 0.13,
      joinedOn: new Date("2023-06-27"),
      city: "Jakarta Selatan",
      kycVerified: true,
      bio: "Penyedia Premium dan akun langganan. Proteksi PIN wajib, tanpa pengecualian.",
    },
  ];

  const sellerIdMap: Record<string, string> = {}; // "slr-01" -> cuid
  for (const s of sellerDefs) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        username: s.username,
        passwordHash: password,
        role: "seller",
        kycStatus: s.kycVerified ? "verified" : "none",
      },
    });
    const profile = await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        storeName: s.storeName,
        handle: s.handle,
        tier: s.tier,
        isOnline: s.isOnline,
        hasExpressBadge: s.hasExpressBadge,
        avgDeliverySeconds: s.avgDeliverySeconds,
        rating: s.rating,
        reviewCount: s.reviewCount,
        ordersCompleted: s.ordersCompleted,
        disputeRatePercent: s.disputeRatePercent,
        joinedOn: s.joinedOn,
        city: s.city,
        kycVerified: s.kycVerified,
        bio: s.bio,
      },
    });
    sellerIdMap[s.id] = profile.id;
  }
  console.log(`  users: 8 (1 admin, 1 buyer, 6 sellers)`);

  // â”€â”€ products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const productDefs = [
    {
      id: "prd-01",
      slug: "robux-1000-bersih-cover-tax-gamepass",
      title: "1.000 Robux Bersih (Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 1000,
      pricingMode: "cover",
      price: listingQuote(1000, "cover").totalIdr,
      compareAtPrice: 168000,
      stock: 428,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-01",
      sold: 2841,
      description: `Kami membeli gamepass milikmu sehingga Robux masuk langsung ke akunmu. Harga gamepass diatur sistem menjadi ${gamepassValue(1000)} Robux agar hasil bersih setelah potongan marketplace Roblox tepat ${formatNumber(1000)} Robux.`,
      highlights: [
        "Instruksi gamepass otomatis dibuat setelah checkout",
        `Cover pajak 30% â€” kamu tetap menerima ${formatNumber(1000)} Robux bersih`,
        "Hasil penjualan berstatus Pending Robux 3â€“7 hari di sisi Roblox",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-02",
      slug: "robux-5000-bersih-cover-tax",
      title: "5.000 Robux Bersih (Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 5000,
      pricingMode: "cover",
      price: listingQuote(5000, "cover").totalIdr,
      compareAtPrice: 789000,
      stock: 164,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-06",
      sold: 1187,
      description:
        "Paket Robux volume menengah dengan cover pajak penuh. Cocok untuk membeli gamepass berbayar atau item limited di katalog Roblox.",
      highlights: [
        `Gamepass dibuatkan otomatis bernilai ${gamepassValue(5000)} Robux`,
        "Estimasi serah terima di bawah 6 menit",
        "Bisa dicicil dari saldo dompet Blox Astra",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-03",
      slug: "robux-1000-no-cover-tax",
      title: "1.000 Robux (No Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 700,
      pricingMode: "no_cover",
      price: listingQuote(700, "no_cover").totalIdr,
      stock: 612,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-05",
      sold: 396,
      description: `Kamu memasang gamepass seharga ${gamepassValue(700)} Robux dan menerima ${formatNumber(700)} Robux bersih setelah potongan 30% milik Roblox. Pilihan termurah per Robux.`,
      highlights: [
        `Harga gamepass ${gamepassValue(700)} Robux, tanpa penyesuaian`,
        "Tarif per Robux lebih murah karena pajak dihitung di sisimu",
        "Stok besar, jarang kehabisan",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-04",
      slug: "gift-card-roblox-10-usd",
      title: "Roblox Gift Card $10 (Kode Digital)",
      categorySlug: "gift",
      game: "Gift Card",
      price: 178000,
      compareAtPrice: 195000,
      stock: 96,
      deliveryKind: "instant_code",
      sellerId: "slr-02",
      sold: 5210,
      description:
        "Kode voucher digital Roblox senilai $10. Kode dikirim otomatis begitu pembayaran terkonfirmasi, tanpa perlu menunggu penjual bangun tidur.",
      highlights: [
        "Kirim otomatis 24/7 langsung ke ruang pesanan",
        "Setara 800 Robux + benefit Premium 1 bulan",
        "Setiap kode diverifikasi sebelum masuk stok",
      ],
      autoReleaseHours: 24,
      instantDelivery: true,
    },
    {
      id: "prd-05",
      slug: "gift-card-roblox-25-usd",
      title: "Roblox Gift Card $25 (Kode Digital)",
      categorySlug: "gift",
      game: "Gift Card",
      price: 434000,
      stock: 41,
      deliveryKind: "instant_code",
      sellerId: "slr-02",
      sold: 2744,
      description:
        "Voucher Roblox $25 untuk pembelian Robux dalam jumlah besar dengan bonus Premium. Pengiriman instan via ruang pesanan.",
      highlights: [
        "Nilai tukar terbaik untuk pembelian volume besar",
        "Riwayat kode tercatat permanen di pesanan",
        "Bisa langsung dipakai untuk membeli Premium bulanan",
      ],
      autoReleaseHours: 24,
      instantDelivery: true,
    },
    {
      id: "prd-06",
      slug: "blox-fruits-permanent-dough",
      title: "Blox Fruits â€” Permanent Dough",
      categorySlug: "item",
      game: "Blox Fruits",
      price: 219000,
      stock: 12,
      deliveryKind: "manual",
      sellerId: "slr-01",
      sold: 863,
      description:
        "Trade langsung di server yang kami tentukan. Penjual menyiapkan private server agar trade tidak terganggu pemain lain, dan kamu bisa memantau seluruh proses lewat chat pesanan.",
      highlights: [
        "Private server VIP disediakan penjual",
        "Trade direkam sebagai bukti ter-watermark",
        "Rata-rata serah terima 8 menit",
      ],
      autoReleaseHours: 48,
      instantDelivery: false,
    },
    {
      id: "prd-07",
      slug: "blox-fruits-permanent-kitsune",
      title: "Blox Fruits â€” Permanent Kitsune",
      categorySlug: "item",
      game: "Blox Fruits",
      price: 385000,
      stock: 5,
      deliveryKind: "manual",
      sellerId: "slr-06",
      sold: 214,
      description:
        "Buah Kitsune permanent untuk akunmu. Stok terbatas dan hanya tersedia saat penjual berstatus online.",
      highlights: [
        "Stok mingguan, dibatasi 5 unit",
        "Penjual wajib online saat order masuk",
        "Ditahan platform hingga kamu menekan konfirmasi",
      ],
      autoReleaseHours: 48,
      instantDelivery: false,
    },
    {
      id: "prd-08",
      slug: "pet-simulator-99-huge-hellish",
      title: "Pet Simulator 99 â€” Huge Hellish Pet",
      categorySlug: "item",
      game: "Pet Simulator 99",
      price: 645000,
      stock: 3,
      deliveryKind: "manual",
      sellerId: "slr-03",
      sold: 121,
      description:
        "Huge pet langka dengan bukti hatch tercatat. Nama pet dan bukti hatch dilampirkan pada ruang pesanan sebelum trade.",
      highlights: [
        "Bukti hatch asli disertakan",
        "Trade via fitur trade resmi Pet Simulator 99",
        "Garansi kilat 10 menit tersedia",
      ],
      autoReleaseHours: 48,
      instantDelivery: false,
    },
    {
      id: "prd-09",
      slug: "anime-vanguards-secret-unit",
      title: "Anime Vanguards â€” Secret Unit Braindog",
      categorySlug: "item",
      game: "Anime Vanguards",
      price: 158000,
      stock: 18,
      deliveryKind: "manual",
      sellerId: "slr-03",
      sold: 447,
      description:
        "Unit rahasia tier tertinggi untuk akunmu. Penjual akan mengajakmu masuk ke private server dan melakukan trade unit.",
      highlights: [
        "Unit secret tier tertinggi",
        "Panduan trade langkah demi langkah di chat",
        "Cocok untuk mendorong progres tower",
      ],
      autoReleaseHours: 48,
      instantDelivery: false,
    },
    {
      id: "prd-10",
      slug: "steal-a-brainrot-sahur-tier",
      title: "Steal a Brainrot â€” Sahur Tier God",
      categorySlug: "gift",
      game: "Steal a Brainrot",
      price: 96000,
      stock: 34,
      deliveryKind: "manual",
      sellerId: "slr-04",
      sold: 1533,
      description:
        "Item dikirim melalui fitur gift in-game ke username Roblox kamu. Pastikan username pada checkout sudah benar karena gift tidak bisa dibatalkan.",
      highlights: [
        "Gift langsung ke username kamu",
        "Verifikasi avatar sebelum checkout",
        "Stok diperbarui tiap 4 jam",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-11",
      slug: "grow-a-garden-moonlit-seed-pack",
      title: "Grow a Garden â€” Moonlit Seed Pack",
      categorySlug: "gift",
      game: "Grow a Garden",
      price: 74000,
      stock: 57,
      deliveryKind: "manual",
      sellerId: "slr-01",
      sold: 2094,
      description:
        "Paket benih Moonlit dikirim lewat fitur gift. Anda hanya perlu berada di server yang sama dengan penjual selama kurang lebih dua menit.",
      highlights: [
        "Pengiriman via gift resmi in-game",
        "Tidak perlu berbagi kata sandi",
        "Bisa diproses saat kamu offline (offline gift)",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-12",
      slug: "akun-roblox-level-100-verified-email",
      title: "Akun Roblox Level 100 + Email Terverifikasi",
      categorySlug: "akun",
      game: "Akun Roblox",
      price: 549000,
      stock: 6,
      deliveryKind: "credential",
      sellerId: "slr-04",
      sold: 78,
      description:
        "Akun siap pakai dengan riwayat bersih, email terverifikasi, dan inventaris game populer. Serah terima dipandu wizard lima langkah: ganti email, putus semua sesi, lalu aktifkan 2FA milikmu.",
      highlights: [
        "Wizard serah terima 5 langkah dengan checklist wajib",
        "Penjual wajib menyerahkan kredensial sementara",
        "Kredensial dihapus permanen 7 hari setelah pesanan selesai",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-13",
      slug: "akun-roblox-starter-2019",
      title: "Akun Roblox Starter 2019 (Rare Username)",
      categorySlug: "akun",
      game: "Akun Roblox",
      price: 289000,
      stock: 4,
      deliveryKind: "credential",
      sellerId: "slr-06",
      sold: 52,
      description:
        "Akun berumur dengan username pendek bergaya lama. Bergaransi penuh sampai proses penggantian email dan pengaktifan 2FA selesai.",
      highlights: [
        "Username pendek usia akun lama",
        "Tanpa riwayat sanksi Roblox",
        "Pendampingan penuh sampai 2FA aktif",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-14",
      slug: "roblox-premium-450-per-bulan",
      title: "Roblox Premium 450 / Bulan",
      categorySlug: "premium",
      game: "Roblox Premium",
      price: 89000,
      stock: 120,
      deliveryKind: "credential",
      sellerId: "slr-06",
      sold: 3410,
      description:
        "Kami masuk ke akunmu untuk membayar langganan Premium dari dalam akun agar tidak kena penolakan metode pembayaran. Kamu wajib menyalakan Parental PIN sebelum menyerahkan kredensial.",
      highlights: [
        "Parental PIN 4 digit wajib aktif sebelum serah terima",
        "Kata sandi dienkripsi dan dihapus otomatis dalam 7 hari",
        "Hanya penjual yang menangani pesanan bisa membuka kredensial",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-15",
      slug: "roblox-premium-1000-per-bulan",
      title: "Roblox Premium 1000 / Bulan",
      categorySlug: "premium",
      game: "Roblox Premium",
      price: 178000,
      stock: 88,
      deliveryKind: "credential",
      sellerId: "slr-02",
      sold: 1962,
      description:
        "Paket Premium 1.000 Robux per bulan dengan pendampingan penuh. Cocok untuk pemilik grup dan kreator yang butuh alokasi Robux lebih besar.",
      highlights: [
        "Alokasi bulanan penuh, tanpa potongan tersembunyi",
        "Pendampingan sampai langganan terlihat aktif",
        "Riwayat pemakaian kredensial tercatat di audit log",
      ],
      autoReleaseHours: 24,
      instantDelivery: false,
    },
    {
      id: "prd-16",
      slug: "robux-10000-bersih-cover-tax",
      title: "10.000 Robux Bersih (Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 10000,
      pricingMode: "cover",
      price: listingQuote(10000, "cover").totalIdr,
      stock: 24,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-06",
      sold: 401,
      description:
        "Paket terbesar untuk kebutuhan grup maupun pembelian limited. Diproses oleh penjual tier Top Vendor dengan rata-rata serah terima di bawah empat menit.",
      highlights: [
        `Gamepass dibuatkan otomatis bernilai ${gamepassValue(10000)} Robux`,
        "Khusus penjual Top Vendor tier 3",
        "Prioritas dukungan bila terjadi kendala",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-17",
      slug: "robux-500-bersih-cover-tax",
      title: "500 Robux Bersih (Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 500,
      pricingMode: "cover",
      price: listingQuote(500, "cover").totalIdr,
      stock: 512,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-01",
      sold: 1420,
      description: `Paket pemula untuk akun baru. Gamepass dibuatkan otomatis senilai ${gamepassValue(500)} Robux sehingga ${formatNumber(500)} Robux bersih masuk ke saldo akunmu setelah potongan marketplace Roblox.`,
      highlights: [
        `Gamepass dibuatkan otomatis bernilai ${gamepassValue(500)} Robux`,
        "Cocok untuk mencoba sistem escrow dulu",
        "Stok besar, jarang kehabisan",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-18",
      slug: "robux-2000-bersih-cover-tax",
      title: "2.000 Robux Bersih (Cover Tax)",
      categorySlug: "gamepass",
      game: "Robux",
      netRobux: 2000,
      pricingMode: "cover",
      price: listingQuote(2000, "cover").totalIdr,
      compareAtPrice: listingQuote(2000, "cover").totalIdr + 12000,
      stock: 268,
      deliveryKind: "gamepass_auto",
      sellerId: "slr-06",
      sold: 967,
      description: `Paket Robux paling laris. Gamepass dibuatkan otomatis bernilai ${gamepassValue(2000)} Robux sehingga ${formatNumber(2000)} Robux bersih masuk ke saldo akunmu setelah potongan marketplace Roblox.`,
      highlights: [
        `Gamepass dibuatkan otomatis bernilai ${gamepassValue(2000)} Robux`,
        "Diskon volume otomatis untuk nominal ini",
        "Estimasi serah terima di bawah enam menit",
      ],
      autoReleaseHours: 72,
      instantDelivery: false,
    },
    {
      id: "prd-19",
      slug: "gift-card-roblox-50-usd",
      title: "Roblox Gift Card $50 (Kode Digital)",
      categorySlug: "gift",
      game: "Gift Card",
      price: 720000,
      compareAtPrice: 765000,
      stock: 34,
      deliveryKind: "instant_code",
      sellerId: "slr-02",
      sold: 612,
      description:
        "Kode voucher digital Roblox senilai $50. Kode dikirim otomatis begitu pembayaran terkonfirmasi, tanpa perlu menunggu penjual bangun tidur.",
      highlights: [
        "Kirim otomatis 24/7 langsung ke ruang pesanan",
        "Setara 4.500 Robux + benefit Premium 1 bulan",
        "Setiap kode diverifikasi sebelum masuk stok",
      ],
      autoReleaseHours: 24,
      instantDelivery: true,
    },
    {
      id: "prd-20",
      slug: "gift-card-roblox-100-usd",
      title: "Roblox Gift Card $100 (Kode Digital)",
      categorySlug: "gift",
      game: "Gift Card",
      price: 1420000,
      compareAtPrice: 1510000,
      stock: 18,
      deliveryKind: "instant_code",
      sellerId: "slr-02",
      sold: 287,
      description:
        "Kode voucher digital Roblox senilai $100. Kode dikirim otomatis begitu pembayaran terkonfirmasi, tanpa perlu menunggu penjual bangun tidur.",
      highlights: [
        "Kirim otomatis 24/7 langsung ke ruang pesanan",
        "Setara 9.000 Robux + benefit Premium 1 bulan",
        "Setiap kode diverifikasi sebelum masuk stok",
      ],
      autoReleaseHours: 24,
      instantDelivery: true,
    },
  ];

  const productIdMap: Record<string, string> = {};
  for (const p of productDefs) {
    const curation = productCuration[p.slug] ?? {};
    const created = await prisma.product.create({
      data: {
        slug: p.slug,
        title: p.title,
        categorySlug: p.categorySlug,
        game: p.game,
        netRobux: p.netRobux,
        pricingMode: p.pricingMode,
        price: p.price,
        compareAtPrice: p.compareAtPrice,
        stock: p.stock,
        deliveryKind: p.deliveryKind,
        sellerId: sellerIdMap[p.sellerId],
        sold: p.sold,
        description: p.description,
        highlights: JSON.stringify(p.highlights),
        autoReleaseHours: p.autoReleaseHours,
        instantDelivery: p.instantDelivery,
        featured: curation.featured ?? false,
        sortOrder: curation.sortOrder ?? 999,
        shelf: curation.shelf ?? null,
      },
    });
    productIdMap[p.id] = created.id;
  }
  console.log(`  products: ${productDefs.length}`);

  // â”€â”€ rate card (active default) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.rateCard.create({
    data: {
      active: true,
      cover: 145,
      noCover: 128,
      vol2000: 0.02,
      vol5000: 0.04,
      vol10000: 0.06,
      orderUsername: 160,
      orderLogin: 150,
      orderGamepassCover: 89.6,
      orderGamepassNoCover: 62.72,
      orderPremium: 185000,
      adminFee: 564,
      updatedBy: "seed",
    },
  });
  console.log("  rateCard: 1 (active default)");

  // â”€â”€ settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const settings: [string, unknown][] = [
    ["payment.fees", { qris: 0, va: 4000, ewallet: 2500 }],
    ["withdrawal", { minAmount: 20000, fee: 2500 }],
    ["robloxTaxRate", 0.7],
    ["sweep.timeouts", { poolHours: 24, processingDays: 7 }],
    [
      "banks",
      ["BCA", "BNI", "Mandiri", "BRI", "CIMB Niaga", "GoPay", "OVO", "DANA"],
    ],
  ];
  for (const [key, value] of settings) {
    await prisma.setting.create({ data: { key, value: JSON.stringify(value) } });
  }
  console.log(`  settings: ${settings.length}`);

  // â”€â”€ promo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  await prisma.promoCode.create({
    data: { code: "HEMAT5RB", type: "fixed", value: 5000, active: true, note: "Promo awal" },
  });
  console.log("  promoCodes: 1");

  // â”€â”€ orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const orderDefs = [
    {
      id: "ord-01",
      code: "BX-9F27K4",
      status: "processing",
      productId: "prd-06",
      sellerId: "slr-01",
      unitPrice: 219000,
      platformFee: 13140,
      total: 232140,
      robloxUsername: "rangga_pradipta",
      expressBadge: true,
      createdAt: new Date("2026-10-09T13:12:00+07:00"),
      events: [
        { state: "pending_payment", label: "Pesanan dibuat", note: "Tagihan QRIS diterbitkan, kedaluwarsa 15 menit", actor: "buyer", at: new Date("2026-10-09T13:12:00+07:00") },
        { state: "paid", label: "Pembayaran terverifikasi", note: "Rp232.140 ditahan di rekening penampungan Blox Astra", actor: "system", at: new Date("2026-10-09T13:13:40+07:00") },
        { state: "processing", label: "Penjual memulai proses", note: "Private server dibuat, tautan dibagikan di chat pesanan", actor: "seller", at: new Date("2026-10-09T13:15:02+07:00") },
      ],
    },
    {
      id: "ord-02",
      code: "BX-9F0C18",
      status: "processing",
      productId: "prd-14",
      sellerId: "slr-06",
      unitPrice: 89000,
      platformFee: 7120,
      total: 96120,
      robloxUsername: "alikanw_07",
      expressBadge: false,
      createdAt: new Date("2026-10-09T12:44:00+07:00"),
      events: [
        { state: "paid", label: "Pembayaran terverifikasi", note: "Rp96.120 ditahan di rekening penampungan Blox Astra", actor: "system", at: new Date("2026-10-09T12:45:12+07:00") },
        { state: "processing", label: "Penjual membuka kredensial", note: "Akses dicatat di audit log Â· pesanan #BX-9F0C18", actor: "seller", at: new Date("2026-10-09T12:47:55+07:00") },
      ],
    },
    {
      id: "ord-03",
      code: "BX-9E77C1",
      status: "shipped",
      productId: "prd-04",
      sellerId: "slr-02",
      unitPrice: 178000,
      platformFee: 8900,
      total: 186900,
      isPoolOrder: true,
      robloxUsername: "bagaspras_",
      expressBadge: true,
      createdAt: new Date("2026-10-09T09:02:00+07:00"),
      events: [
        { state: "paid", label: "Dibayar & dilempar ke pool", note: "Diklaim Kirana Blox dalam 6 detik", actor: "system", at: new Date("2026-10-09T09:03:10+07:00") },
        { state: "shipped", label: "Kode voucher terkirim otomatis", note: "Kode RA9F-2K71-â€¢â€¢â€¢â€¢-â€¢â€¢â€¢â€¢ tersimpan pada ruang pesanan", actor: "system", at: new Date("2026-10-09T09:04:22+07:00") },
      ],
    },
    {
      id: "ord-04",
      code: "BX-8C41D2",
      status: "disputed",
      productId: "prd-08",
      sellerId: "slr-03",
      unitPrice: 645000,
      platformFee: 38700,
      total: 683700,
      robloxUsername: "nadhira_udh",
      expressBadge: false,
      createdAt: new Date("2026-10-07T16:40:00+07:00"),
      events: [
        { state: "pending_payment", label: "Pesanan dibuat", note: "Tagihan QRIS diterbitkan, kedaluwarsa 15 menit", actor: "buyer", at: new Date("2026-10-07T16:40:00+07:00") },
        { state: "paid", label: "Pembayaran terverifikasi", note: "Rp683.700 ditahan di rekening penampungan Blox Astra", actor: "system", at: new Date("2026-10-07T16:44:12+07:00") },
        { state: "processing", label: "Penjual memulai proses", note: "Trade dijadwalkan di server publik", actor: "seller", at: new Date("2026-10-07T16:51:30+07:00") },
        { state: "shipped", label: "Bukti serah terima diunggah", note: "Penjual mengirim tangkapan layar trade dengan watermark dinamis", actor: "seller", at: new Date("2026-10-07T17:06:44+07:00") },
        { state: "disputed", label: "Sengketa diajukan pembeli", note: "Pet yang diterima bukan Huge Hellish sesuai listing", actor: "buyer", at: new Date("2026-10-08T09:18:05+07:00") },
      ],
      dispute: {
        ref: "DSP-BX-8C41D2",
        reasonId: "item_invalid",
        reasonLabel: "Item tidak sesuai",
        buyerNote:
          "Trade masuk jam 17:06, tetapi pet yang aku terima Huge Plasma bukan Huge Hellish. Nama pet sudah aku cocokkan dari riwayat trade Roblox, beda dari judul listing.",
        sellerReply:
          "Stok Huge Hellish habis saat klaim, pembeli saya tawari Huge Plasma dengan nilai lebih tinggi dan dia menerima lewat chat. Bukti chat saya lampirkan.",
        evidence: [
          "Tangkapan layar riwayat trade Roblox (pembeli)",
          "Riwayat chat persetujuan penggantian pet (penjual)",
          "Bukti serah terima ber-watermark dari ruang pesanan",
        ],
        openedAt: new Date("2026-10-08T09:18:05+07:00"),
        slaHoursLeft: 14,
      },
    },
    {
      id: "ord-05",
      code: "BX-7D33A9",
      status: "disputed",
      productId: "prd-11",
      sellerId: "slr-01",
      unitPrice: 74000,
      platformFee: 4440,
      total: 78440,
      isPoolOrder: true,
      robloxUsername: "rafly_afx",
      expressBadge: true,
      createdAt: new Date("2026-10-06T20:11:00+07:00"),
      events: [
        { state: "paid", label: "Dibayar & dilempar ke pool", note: "Diklaim Pilar Vault dalam 9 detik", actor: "system", at: new Date("2026-10-06T20:11:44+07:00") },
        { state: "paid", label: "Pembayaran terverifikasi", note: "Rp78.440 ditahan di rekening penampungan Blox Astra", actor: "system", at: new Date("2026-10-06T20:11:40+07:00") },
        { state: "processing", label: "Penjual memulai proses", note: "Menunggu konfirmasi pengiriman in-game", actor: "seller", at: new Date("2026-10-06T20:14:03+07:00") },
        { state: "shipped", label: "Pesanan ditandai terkirim", note: "Penjual menandai pack sudah dikirim ke inventaris", actor: "seller", at: new Date("2026-10-06T20:29:51+07:00") },
        { state: "disputed", label: "Sengketa diajukan pembeli", note: "Seed pack tidak pernah masuk ke inventaris", actor: "buyer", at: new Date("2026-10-07T08:02:19+07:00") },
      ],
      dispute: {
        ref: "DSP-BX-7D33A9",
        reasonId: "not_received",
        reasonLabel: "Barang tidak diterima",
        buyerNote:
          "Pesanan ditandai terkirim jam 20:29, tapi sampai pagi inventaris Moonlit Seed Pack tetap kosong. Aku sudah reload server tiga kali.",
        sellerReply:
          "Pengiriman dilakukan tepat setelah pesanan ditandai, kemungkinan masuk ke akun alt karena username pembeli berubah di tengah proses. Saya minta admin cek log.",
        evidence: [
          "Tangkapan layar inventaris kosong (pembeli)",
          "Log pengiriman dari sisi penjual",
          "Riwayat chat pesanan ber-watermark",
        ],
        openedAt: new Date("2026-10-07T08:02:19+07:00"),
        slaHoursLeft: 3,
      },
    },
  ];

  const orderIdMap: Record<string, string> = {};
  for (const o of orderDefs) {
    const created = await prisma.order.create({
      data: {
        code: o.code,
        status: o.status,
        buyerId: buyer.id,
        productId: productIdMap[o.productId],
        sellerId: sellerIdMap[o.sellerId],
        unitPrice: o.unitPrice,
        platformFee: o.platformFee,
        total: o.total,
        robloxUsername: o.robloxUsername,
        isPoolOrder: o.isPoolOrder ?? false,
        expressBadge: o.expressBadge,
        createdAt: o.createdAt,
      },
    });
    orderIdMap[o.id] = created.id;

    for (const e of o.events) {
      await prisma.orderEvent.create({
        data: { orderId: created.id, ...e },
      });
    }

    if (o.dispute) {
      await prisma.dispute.create({
        data: {
          orderId: created.id,
          ref: o.dispute.ref,
          reasonId: o.dispute.reasonId,
          reasonLabel: o.dispute.reasonLabel,
          buyerNote: o.dispute.buyerNote,
          sellerReply: o.dispute.sellerReply,
          evidence: JSON.stringify(o.dispute.evidence),
          openedAt: o.dispute.openedAt,
          slaHoursLeft: o.dispute.slaHoursLeft,
        },
      });
    }
  }
  console.log(`  orders: ${orderDefs.length} (+events, +2 disputes)`);

  // â”€â”€ seed chat for ord-01 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ord01 = orderIdMap["ord-01"];
  await prisma.message.createMany({
    data: [
      { orderId: ord01, fromRole: "system", body: "Dana ditahan sistem sampai kamu menekan konfirmasi terima.", at: new Date("2026-10-09T13:15:10+07:00") },
      { orderId: ord01, fromRole: "seller", body: "Halo! Private server sudah aku siapkan. Silakan join lewat tautan di bawah ya.", at: new Date("2026-10-09T13:15:40+07:00") },
      { orderId: ord01, fromRole: "buyer", body: "Siap, aku join sebentar lagi.", at: new Date("2026-10-09T13:16:05+07:00") },
    ],
  });
  console.log("  messages: 3 (ord-01)");

  // â”€â”€ wallet ledger (for slr-01) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const slr01 = sellerIdMap["slr-01"];
  const ledger = [
    { type: "earning", amount: 271400, balanceAfter: 3428790, orderCode: "BX-9E77C1", note: "Pencairan dana order selesai â€” komisi platform 4,5%", createdAt: new Date("2026-10-09T11:02:00+07:00") },
    { type: "protection_bailout", amount: -5000, balanceAfter: 3157390, orderCode: "BX-9E4A08", note: "Voucher kompensasi keterlambatan SLA Kilat 10 Menit", createdAt: new Date("2026-10-09T09:18:00+07:00") },
    { type: "withdrawal", amount: -1200000, balanceAfter: 3162390, note: "Penarikan ke BCA Â·Â·Â·Â·4471 disetujui", createdAt: new Date("2026-10-08T20:40:00+07:00") },
    { type: "earning", amount: 187000, balanceAfter: 4362390, orderCode: "BX-9D9F33", note: "Pencairan dana order selesai", createdAt: new Date("2026-10-08T17:11:00+07:00") },
    { type: "penalty_debt", amount: -720000, balanceAfter: 4175390, orderCode: "BX-9C12BB", note: "Debit paksa kasus carding â€” dalam masa penyelesaian 1Ã—24 jam", createdAt: new Date("2026-10-07T22:55:00+07:00") },
    { type: "earning", amount: 412800, balanceAfter: 4895390, orderCode: "BX-9B88A0", note: "Pencairan dana order selesai", createdAt: new Date("2026-10-07T14:31:00+07:00") },
    { type: "refund", amount: -96000, balanceAfter: 4482590, orderCode: "BX-9A5561", note: "Refund sengketa diterima pembeli â€” barang tidak sesuai", createdAt: new Date("2026-10-06T19:24:00+07:00") },
    { type: "earning", amount: 156400, balanceAfter: 4578590, orderCode: "BX-99E712", note: "Pencairan dana order selesai", createdAt: new Date("2026-10-06T11:07:00+07:00") },
  ];
  for (const l of ledger) {
    await prisma.walletLedger.create({
      data: { userId: buyer.id, sellerId: slr01, ...l },
    });
  }
  console.log(`  walletLedger: ${ledger.length}`);

  // â”€â”€ admin audit logs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const auditLogs = [
    { actionType: "credential.decrypt", targetResource: "credentials", targetId: "ord-02", diffPayload: `{ token: "sess_9d1f", released_to: "seller:slr-06", ttl_seconds: 120 }`, ipAddress: "103.94.12.8", actor: "seller:slr-06", createdAt: new Date("2026-10-09T14:02:41+07:00") },
    { actionType: "kyc.approve", targetResource: "users", targetId: "slr-04", diffPayload: `{ kyc_status: "pending â†’ verified", tier: "2 â†’ 3", reviewer: "admin@bloxastra" }`, ipAddress: "103.94.12.8", actor: "admin@bloxastra", createdAt: new Date("2026-10-09T11:20:03+07:00") },
    { actionType: "dispute.open", targetResource: "orders", targetId: "ord-04", diffPayload: `{ state: "shipped â†’ disputed", escrow: "frozen", buyer: "nadhira_udh" }`, ipAddress: "103.94.12.8", actor: "system", createdAt: new Date("2026-10-08T09:18:06+07:00") },
    { actionType: "dispute.open", targetResource: "orders", targetId: "ord-05", diffPayload: `{ state: "shipped â†’ disputed", escrow: "frozen", buyer: "rafly_afx" }`, ipAddress: "103.94.12.8", actor: "system", createdAt: new Date("2026-10-07T08:02:20+07:00") },
    { actionType: "escrow.release", targetResource: "wallets", targetId: "ord-03", diffPayload: `{ amount: 178000, payout: "manual", reference: "manual_payout_20261006" }`, ipAddress: "103.94.12.8", actor: "admin@bloxastra", createdAt: new Date("2026-10-06T19:44:55+07:00") },
  ];
  for (const a of auditLogs) {
    await prisma.adminAuditLog.create({ data: a });
  }
  console.log(`  adminAuditLogs: ${auditLogs.length}`);

  console.log("Seed complete.");
  console.log("");
  console.log("Demo accounts (password in parentheses):");
  console.log("  buyer   pembeli@bloxastra  (demo1234)");
  console.log("  seller  slr01@bloxastra    (demo1234)  â€¦ slr06@bloxastra");
  console.log("  admin   admin@bloxastra    (astra1234)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
