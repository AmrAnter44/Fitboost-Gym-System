-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "itemDetails" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT,
    "ptId" TEXT,
    "dayUseId" TEXT,
    CONSTRAINT "Receipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_ptId_fkey" FOREIGN KEY ("ptId") REFERENCES "PT" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_dayUseId_fkey" FOREIGN KEY ("dayUseId") REFERENCES "DayUseInBody" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "ptId", "receiptNumber", "type") SELECT "amount", "createdAt", "dayUseId", "id", "itemDetails", "memberId", "ptId", "receiptNumber", "type" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
