// Salinan DB dev (prisma/verify.db) supaya halaman yang butuh listing aktif bisa diuji.
// Jalankan dengan DATABASE_URL="file:./verify.db"; DB asli tidak disentuh.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

await prisma.product.updateMany({ data: { isListed: true, stock: 40 } });
await prisma.sellerProfile.updateMany({ data: { isOnline: true, kycVerified: true } });

console.log(
  JSON.stringify({
    produkAktif: await prisma.product.count({ where: { isListed: true } }),
    tokoOnline: await prisma.sellerProfile.count({ where: { isOnline: true } }),
    user: await prisma.user.count(),
  }),
);

await prisma.$disconnect();
