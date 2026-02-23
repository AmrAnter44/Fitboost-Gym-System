/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `Member` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "profileImage" TEXT,
    "inBodyScans" INTEGER NOT NULL DEFAULT 0,
    "invitations" INTEGER NOT NULL DEFAULT 0,
    "freePTSessions" INTEGER NOT NULL DEFAULT 0,
    "subscriptionPrice" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" DATETIME,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Member" ("createdAt", "expiryDate", "freePTSessions", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "remainingAmount", "startDate", "subscriptionPrice") SELECT "createdAt", "expiryDate", "freePTSessions", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "remainingAmount", "startDate", "subscriptionPrice" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
