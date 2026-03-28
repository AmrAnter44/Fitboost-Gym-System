-- Migration: Add gymName to SystemSettings and freeMoreSessions to Member
-- Added in v5.8.x
-- Safe: Electron migration engine skips "already exists" errors

ALTER TABLE "SystemSettings" ADD COLUMN "gymName" TEXT;
ALTER TABLE "Member" ADD COLUMN "freeMoreSessions" INTEGER NOT NULL DEFAULT 0;
