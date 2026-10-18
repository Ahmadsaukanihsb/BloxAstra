-- "Log out of all devices": a session generation stamped into the cookie.
-- See the note in 20261016170000_add_user_suspension about the pre-existing
-- shadow-DB breakage — this migration only touches "User".
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;