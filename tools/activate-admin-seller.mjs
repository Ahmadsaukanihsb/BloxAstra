// Di DB salinan saja: pastikan akun admin punya profil penjual agar
// /dashboard/penjual bisa dinilai sebagai pemilik toko.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const user = await prisma.user.findUnique({ where: { email: "admin@bloxastra" }, select: { id: true, username: true } });
if (!user) throw new Error("admin tidak ada di salinan ini");

const existing = await prisma.sellerProfile.findUnique({ where: { userId: user.id } });
if (existing) {
  console.log("sudah ada:", existing.storeName, "| online:", existing.isOnline, "| kyc:", existing.kycVerified);
} else {
  const created = await prisma.sellerProfile.create({
    data: {
      userId: user.id,
      storeName: "VaultNusantara",
      handle: `admin-preview-${Date.now()}`,
      isOnline: true,
      kycVerified: true,
      tier: 3,
      city: "Jakarta",
      bio: "Toko pratinjau admin.",
    },
  });
  console.log("dibuat:", created.storeName, created.id);
}
await prisma.$disconnect();
