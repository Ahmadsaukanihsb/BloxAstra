-- Admin moderation: account suspension (append-only; see note below).
--
-- NOTE on history: migration 20261012174322 assumes SellerChatMessage exists,
-- but no earlier migration creates it (it reached the DB via `db push`), so
-- `migrate dev`'s shadow-DB validation was already broken before this file.
-- This migration only touches "User", so `migrate deploy` applies cleanly.
-- Do NOT edit already-applied migrations to fix the shadow; baseline instead.
ALTER TABLE "User" ADD COLUMN "suspendedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "suspendReason" TEXT;
