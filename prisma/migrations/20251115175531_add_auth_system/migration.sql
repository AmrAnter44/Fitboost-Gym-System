-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "canViewMembers" BOOLEAN NOT NULL DEFAULT false,
    "canCreateMembers" BOOLEAN NOT NULL DEFAULT false,
    "canEditMembers" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteMembers" BOOLEAN NOT NULL DEFAULT false,
    "canViewPT" BOOLEAN NOT NULL DEFAULT false,
    "canCreatePT" BOOLEAN NOT NULL DEFAULT false,
    "canEditPT" BOOLEAN NOT NULL DEFAULT false,
    "canDeletePT" BOOLEAN NOT NULL DEFAULT false,
    "canViewStaff" BOOLEAN NOT NULL DEFAULT false,
    "canCreateStaff" BOOLEAN NOT NULL DEFAULT false,
    "canEditStaff" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteStaff" BOOLEAN NOT NULL DEFAULT false,
    "canViewReceipts" BOOLEAN NOT NULL DEFAULT false,
    "canEditReceipts" BOOLEAN NOT NULL DEFAULT false,
    "canDeleteReceipts" BOOLEAN NOT NULL DEFAULT false,
    "canViewReports" BOOLEAN NOT NULL DEFAULT false,
    "canViewFinancials" BOOLEAN NOT NULL DEFAULT false,
    "canAccessSettings" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Permission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_userId_key" ON "Permission"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
