/**
 * Production baseline seed — IDEMPOTEN, TANPA WIPE.
 *
 * Only ensures the rows the app cannot run without:
 * categories, settings, one active rate card, and the admin account.
 * No demo users, products, orders, ledger, or promos.
 *
 * Run with:  npm run db:seed:prod
 * Safe to re-run anytime (upserts + exists-checks only).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CATEGORIES = [
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

const SETTINGS: [string, unknown][] = [
  ["payment.fees", { qris: 0, va: 4000, ewallet: 2500 }],
  ["withdrawal", { minAmount: 20000, fee: 2500 }],
  ["robloxTaxRate", 0.7],
  ["sweep.timeouts", { poolHours: 24, processingDays: 7, assignedHours: 72 }],
  ["banks", ["BCA", "BNI", "Mandiri", "BRI", "CIMB Niaga", "GoPay", "OVO", "DANA"]],
];

async function main() {
  console.log("Seeding production baseline (no wipe) …");

  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        tagline: category.tagline,
        fulfillment: category.fulfillment,
        slaMinutes: category.slaMinutes,
        taxCoverSupported: category.taxCoverSupported,
        autoDelivery: category.autoDelivery,
        commissionPercent: category.commissionPercent,
      },
      create: category,
    });
  }
  console.log(`  categories: ${CATEGORIES.length} upserted`);

  for (const [key, value] of SETTINGS) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: JSON.stringify(value) },
    });
  }
  console.log(`  settings: ${SETTINGS.length} ensured (existing values untouched)`);

  const activeCard = await prisma.rateCard.findFirst({
    where: { active: true },
    select: { id: true },
  });
  if (!activeCard) {
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
        orderGamepass: 89.6,
        orderPremium: 185000,
        adminFee: 564,
        updatedBy: "seed-prod",
      },
    });
    console.log("  rateCard: 1 created (none was active)");
  } else {
    console.log("  rateCard: active card already present, skipped");
  }

  const adminEmail = "admin@bloxastra";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        username: "admin",
        passwordHash: await bcrypt.hash("astra1234", 10),
        role: "admin",
      },
    });
    console.log("  admin: created (admin@bloxastra / astra1234 — GANTI PASSWORD SEGERA)");
  } else {
    console.log("  admin: already present, skipped");
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error("seed-prod failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
