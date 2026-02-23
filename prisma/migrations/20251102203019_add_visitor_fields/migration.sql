-- CreateTable
CREATE TABLE "PTSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ptNumber" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "coachName" TEXT NOT NULL,
    "sessionDate" DATETIME NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PTSession_ptNumber_fkey" FOREIGN KEY ("ptNumber") REFERENCES "PT" ("ptNumber") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "visitorId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "contacted" BOOLEAN NOT NULL DEFAULT false,
    "nextFollowUpDate" DATETIME,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FollowUp_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Visitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'walk-in',
    "interestedIn" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Visitor" ("createdAt", "id", "name", "notes", "phone", "updatedAt") SELECT "createdAt", "id", "name", "notes", "phone", "updatedAt" FROM "Visitor";
DROP TABLE "Visitor";
ALTER TABLE "new_Visitor" RENAME TO "Visitor";
CREATE UNIQUE INDEX "Visitor_phone_key" ON "Visitor"("phone");
CREATE INDEX "Visitor_status_idx" ON "Visitor"("status");
CREATE INDEX "Visitor_createdAt_idx" ON "Visitor"("createdAt");
CREATE INDEX "Visitor_phone_idx" ON "Visitor"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PTSession_ptNumber_idx" ON "PTSession"("ptNumber");

-- CreateIndex
CREATE INDEX "PTSession_sessionDate_idx" ON "PTSession"("sessionDate");

-- CreateIndex
CREATE INDEX "FollowUp_visitorId_idx" ON "FollowUp"("visitorId");

-- CreateIndex
CREATE INDEX "FollowUp_nextFollowUpDate_idx" ON "FollowUp"("nextFollowUpDate");

-- CreateIndex
CREATE INDEX "FollowUp_contacted_idx" ON "FollowUp"("contacted");
