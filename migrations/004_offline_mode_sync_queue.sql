-- Migration: Offline Mode sync infrastructure
-- Adds offlineModeEnabled flag to SupabaseLicense + new SyncQueueItem table
-- Safe: migration runner skips "column already exists" / "table already exists" errors

ALTER TABLE "SupabaseLicense" ADD COLUMN "offlineModeEnabled" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "SyncQueueItem" (
  "id"         TEXT PRIMARY KEY,
  "resource"   TEXT NOT NULL,
  "operation"  TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "payload"    TEXT NOT NULL,
  "attempts"   INTEGER NOT NULL DEFAULT 0,
  "lastError"  TEXT,
  "status"     TEXT NOT NULL DEFAULT 'pending',
  "createdAt"  DATETIME NOT NULL DEFAULT (datetime('now')),
  "sentAt"     DATETIME
);

CREATE INDEX IF NOT EXISTS "SyncQueueItem_status_idx"    ON "SyncQueueItem"("status");
CREATE INDEX IF NOT EXISTS "SyncQueueItem_resource_idx"  ON "SyncQueueItem"("resource");
CREATE INDEX IF NOT EXISTS "SyncQueueItem_createdAt_idx" ON "SyncQueueItem"("createdAt");
