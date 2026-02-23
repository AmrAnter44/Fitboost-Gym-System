-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "inBodyScans" INTEGER NOT NULL DEFAULT 0,
    "invitations" INTEGER NOT NULL DEFAULT 0,
    "subscriptionPrice" REAL NOT NULL,
    "remainingAmount" REAL NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PT" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sessionsPurchased" INTEGER NOT NULL,
    "sessionsRemaining" INTEGER NOT NULL,
    "coachName" TEXT NOT NULL,
    "pricePerSession" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DayUseInBody" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "staffName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Visitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "itemDetails" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT,
    "ptId" TEXT,
    "dayUseId" TEXT,
    CONSTRAINT "Receipt_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_ptId_fkey" FOREIGN KEY ("ptId") REFERENCES "PT" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Receipt_dayUseId_fkey" FOREIGN KEY ("dayUseId") REFERENCES "DayUseInBody" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReceiptCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "current" INTEGER NOT NULL DEFAULT 1000
);

-- CreateTable
CREATE TABLE "MemberCounter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "current" INTEGER NOT NULL DEFAULT 1000
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_memberNumber_key" ON "Member"("memberNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNumber_key" ON "Receipt"("receiptNumber");
