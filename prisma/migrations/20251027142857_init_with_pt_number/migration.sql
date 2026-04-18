/*
  Warnings:

  - The primary key for the `PT` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `PT` table. All the data in the column will be lost.
  - You are about to drop the column `ptId` on the `Receipt` table. All the data in the column will be lost.
  - Added the required column `ptNumber` to the `PT` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PT" (
    "ptNumber" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sessionsPurchased" INTEGER NOT NULL,
    "sessionsRemaining" INTEGER NOT NULL,
    "coachName" TEXT NOT NULL,
    "pricePerSession" REAL NOT NULL,
    "startDate" DATETIME,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_PT" ("clientName", "coachName", "createdAt", "expiryDate", "phone", "pricePerSession", "sessionsPurchased", "sessionsRemaining", "startDate", "updatedAt") SELECT "clientName", "coachName", "createdAt", "expiryDate", "phone", "pricePerSession", "sessionsPurchased", "sessionsRemaining", "startDate", "updatedAt" FROM "PT";
DROP TABLE "PT";
ALTER TABLE "new_PT" RENAME TO "PT";
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
    CONSTRAINT "Receipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_ptNumber_fkey" FOREIGN KEY ("ptNumber") REFERENCES "PT" ("ptNumber") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_dayUseId_fkey" FOREIGN KEY ("dayUseId") REFERENCES "DayUseInBody" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "paymentMethod", "receiptNumber", "type") SELECT "amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "paymentMethod", "receiptNumber", "type" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
