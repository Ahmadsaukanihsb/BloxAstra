-- AlterTable
ALTER TABLE "Message" ADD COLUMN "image" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "buyerReadAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "sellerReadAt" DATETIME;
