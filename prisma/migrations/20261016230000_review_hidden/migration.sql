-- Admin moderation: hide individual buyer reviews (append-only; see the
-- note in 20261016170000_add_user_suspension about the pre-existing
-- shadow-DB breakage — this migration only touches "Review", so
-- `migrate deploy` applies cleanly).
ALTER TABLE "Review" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
