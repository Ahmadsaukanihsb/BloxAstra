-- AlterTable
ALTER TABLE "SellerChatMessage" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "SellerChatMessage" ADD COLUMN "editedAt" DATETIME;
ALTER TABLE "SellerChatMessage" ADD COLUMN "replyToId" TEXT REFERENCES "SellerChatMessage" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SellerChatReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SellerChatMessage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerChatReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SellerChatMessage_replyToId_idx" ON "SellerChatMessage"("replyToId");

-- CreateIndex
CREATE UNIQUE INDEX "SellerChatReport_messageId_reporterId_key" ON "SellerChatReport"("messageId", "reporterId");

-- CreateIndex
CREATE INDEX "SellerChatReport_createdAt_idx" ON "SellerChatReport"("createdAt");
