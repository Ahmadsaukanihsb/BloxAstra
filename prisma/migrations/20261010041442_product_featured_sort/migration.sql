-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "netRobux" INTEGER,
    "pricingMode" TEXT,
    "price" INTEGER NOT NULL,
    "compareAtPrice" INTEGER,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "deliveryKind" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL,
    "highlights" TEXT NOT NULL,
    "autoReleaseHours" INTEGER NOT NULL DEFAULT 24,
    "instantDelivery" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categorySlug_fkey" FOREIGN KEY ("categorySlug") REFERENCES "Category" ("slug") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "SellerProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("autoReleaseHours", "categorySlug", "compareAtPrice", "createdAt", "deliveryKind", "description", "game", "highlights", "id", "instantDelivery", "netRobux", "price", "pricingMode", "sellerId", "slug", "sold", "stock", "title", "updatedAt") SELECT "autoReleaseHours", "categorySlug", "compareAtPrice", "createdAt", "deliveryKind", "description", "game", "highlights", "id", "instantDelivery", "netRobux", "price", "pricingMode", "sellerId", "slug", "sold", "stock", "title", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE INDEX "Product_categorySlug_idx" ON "Product"("categorySlug");
CREATE INDEX "Product_sellerId_idx" ON "Product"("sellerId");
CREATE INDEX "Product_featured_idx" ON "Product"("featured");
CREATE INDEX "Product_sortOrder_idx" ON "Product"("sortOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
