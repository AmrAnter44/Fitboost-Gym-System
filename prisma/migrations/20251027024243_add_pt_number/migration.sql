-- AlterTable
ALTER TABLE "PT" ADD COLUMN "expiryDate" DATETIME;
ALTER TABLE "PT" ADD COLUMN "startDate" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "inBodyScans" INTEGER NOT NULL DEFAULT 0,
    "invitations" INTEGER NOT NULL DEFAULT 0,
    "freePTSessions" INTEGER NOT NULL DEFAULT 0,
    "subscriptionPrice" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Member" ("createdAt", "expiryDate", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "remainingAmount", "startDate", "subscriptionPrice", "updatedAt") SELECT "createdAt", "expiryDate", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "remainingAmount", "startDate", "subscriptionPrice", "updatedAt" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
