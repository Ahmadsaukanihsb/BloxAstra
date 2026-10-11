-- AlterTable
ALTER TABLE "Product" ADD COLUMN "shelf" TEXT;

-- CreateIndex
CREATE INDEX "Product_shelf_idx" ON "Product"("shelf");
