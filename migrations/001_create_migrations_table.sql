-- Migration: Create migrations tracking table
-- Created: 2026-03-15

CREATE TABLE IF NOT EXISTS "_migrations" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL UNIQUE,
  "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
