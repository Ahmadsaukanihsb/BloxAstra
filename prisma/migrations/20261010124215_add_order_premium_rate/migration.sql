-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RateCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cover" REAL NOT NULL,
    "noCover" REAL NOT NULL,
    "vol2000" REAL NOT NULL DEFAULT 0.02,
    "vol5000" REAL NOT NULL DEFAULT 0.04,
    "vol10000" REAL NOT NULL DEFAULT 0.06,
    "orderUsername" REAL NOT NULL DEFAULT 160,
    "orderLogin" REAL NOT NULL DEFAULT 150,
    "orderGamepass" REAL NOT NULL DEFAULT 89.6,
    "orderPremium" REAL NOT NULL DEFAULT 185000,
    "adminFee" REAL NOT NULL DEFAULT 564,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RateCard" ("active", "adminFee", "cover", "createdAt", "id", "noCover", "orderGamepass", "orderLogin", "orderUsername", "updatedAt", "updatedBy", "vol10000", "vol2000", "vol5000") SELECT "active", "adminFee", "cover", "createdAt", "id", "noCover", "orderGamepass", "orderLogin", "orderUsername", "updatedAt", "updatedBy", "vol10000", "vol2000", "vol5000" FROM "RateCard";
DROP TABLE "RateCard";
ALTER TABLE "new_RateCard" RENAME TO "RateCard";
CREATE INDEX "RateCard_active_idx" ON "RateCard"("active");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
