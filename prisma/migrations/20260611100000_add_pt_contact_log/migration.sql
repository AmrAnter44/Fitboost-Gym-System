-- Migration: سجل متابعات اشتراكات PT
-- نتتبع المكالمات والـ WhatsApp اللي اتعملت لكل عميل PT مع نتايجها

CREATE TABLE "PTContactLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ptNumber" INTEGER NOT NULL,
    "activityType" TEXT NOT NULL,
    "result" TEXT,
    "notes" TEXT,
    "nextContactAt" DATETIME,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PTContactLog_ptNumber_fkey" FOREIGN KEY ("ptNumber") REFERENCES "PT" ("ptNumber") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PTContactLog_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Staff" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PTContactLog_ptNumber_createdAt_idx" ON "PTContactLog"("ptNumber", "createdAt");
