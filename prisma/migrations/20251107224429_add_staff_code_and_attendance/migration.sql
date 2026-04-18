/*
  Warnings:

  - You are about to drop the column `staffName` on the `Receipt` table. All the data in the column will be lost.
  - Made the column `memberNumber` on table `Member` required. This step will fail if there are existing NULL values in that column.
  - Made the column `staffCode` on table `Staff` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME,
    "duration" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Attendance" ("checkIn", "checkOut", "createdAt", "duration", "id", "notes", "staffId") SELECT "checkIn", "checkOut", "createdAt", "duration", "id", "notes", "staffId" FROM "Attendance";
DROP TABLE "Attendance";
ALTER TABLE "new_Attendance" RENAME TO "Attendance";
CREATE INDEX "Attendance_staffId_idx" ON "Attendance"("staffId");
CREATE INDEX "Attendance_checkIn_idx" ON "Attendance"("checkIn");
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
INSERT INTO "new_Member" ("createdAt", "expiryDate", "freePTSessions", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "profileImage", "remainingAmount", "startDate", "subscriptionPrice") SELECT "createdAt", "expiryDate", "freePTSessions", "id", "inBodyScans", "invitations", "isActive", "memberNumber", "name", "notes", "phone", "profileImage", "remainingAmount", "startDate", "subscriptionPrice" FROM "Member";
DROP TABLE "Member";
ALTER TABLE "new_Member" RENAME TO "Member";
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");
CREATE TABLE "new_MemberCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "current" INTEGER NOT NULL DEFAULT 1000
);
INSERT INTO "new_MemberCounter" ("current", "id") SELECT "current", "id" FROM "MemberCounter";
DROP TABLE "MemberCounter";
ALTER TABLE "new_MemberCounter" RENAME TO "MemberCounter";
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "itemDetails" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT,
    "ptNumber" INTEGER,
    "dayUseId" TEXT,
    CONSTRAINT "Receipt_dayUseId_fkey" FOREIGN KEY ("dayUseId") REFERENCES "DayUseInBody" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_ptNumber_fkey" FOREIGN KEY ("ptNumber") REFERENCES "PT" ("ptNumber") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "paymentMethod", "ptNumber", "receiptNumber", "type") SELECT "amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "paymentMethod", "ptNumber", "receiptNumber", "type" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
CREATE TABLE "new_ReceiptCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "current" INTEGER NOT NULL DEFAULT 1000
);
INSERT INTO "new_ReceiptCounter" ("current", "id") SELECT "current", "id" FROM "ReceiptCounter";
DROP TABLE "ReceiptCounter";
ALTER TABLE "new_ReceiptCounter" RENAME TO "ReceiptCounter";
CREATE TABLE "new_Staff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffCode" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "position" TEXT,
    "salary" REAL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Staff" ("createdAt", "id", "isActive", "name", "notes", "phone", "position", "salary", "staffCode", "updatedAt") SELECT "createdAt", "id", "isActive", "name", "notes", "phone", "position", "salary", "staffCode", "updatedAt" FROM "Staff";
DROP TABLE "Staff";
ALTER TABLE "new_Staff" RENAME TO "Staff";
CREATE UNIQUE INDEX "Staff_staffCode_key" ON "Staff"("staffCode");
CREATE INDEX "Staff_staffCode_idx" ON "Staff"("staffCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
