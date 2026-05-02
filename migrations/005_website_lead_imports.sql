-- Migration: Track website leads imported from public xgym/* websites
-- Each row marks a lead that was already turned into a local Visitor.

CREATE TABLE IF NOT EXISTS "WebsiteLeadImport" (
  "id"         TEXT PRIMARY KEY,
  "remoteId"   TEXT NOT NULL UNIQUE,
  "visitorId"  TEXT,
  "importedAt" DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS "WebsiteLeadImport_remoteId_idx" ON "WebsiteLeadImport"("remoteId");
