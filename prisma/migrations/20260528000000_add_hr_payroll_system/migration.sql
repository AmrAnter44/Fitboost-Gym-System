-- Migration: نظام الـ HR/Payroll الذكي
-- Added: Bonus, Leave, ShiftAssignment, Payslip, Holiday, SalaryChangeLog
-- + extra columns على Staff, Expense, SystemSettings

-- ============================================================================
-- New Tables
-- ============================================================================

-- CreateTable Bonus
CREATE TABLE "Bonus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bonus_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Bonus_staffId_year_month_idx" ON "Bonus"("staffId", "year", "month");

-- CreateTable Leave
CREATE TABLE "Leave" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Leave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Leave_staffId_startDate_idx" ON "Leave"("staffId", "startDate");

-- CreateTable ShiftAssignment
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ShiftAssignment_staffId_date_idx" ON "ShiftAssignment"("staffId", "date");
CREATE INDEX "ShiftAssignment_date_idx" ON "ShiftAssignment"("date");

-- CreateTable Payslip
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    "totalBonuses" REAL NOT NULL DEFAULT 0,
    "totalCommission" REAL NOT NULL DEFAULT 0,
    "absenceDays" INTEGER NOT NULL DEFAULT 0,
    "absenceDeduction" REAL NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "latePenalty" REAL NOT NULL DEFAULT 0,
    "manualDeductions" REAL NOT NULL DEFAULT 0,
    "loansDeducted" REAL NOT NULL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    "breakdown" TEXT NOT NULL,
    "paidAt" DATETIME,
    "paidBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" TEXT,
    "paymentNote" TEXT,
    "voidReason" TEXT,
    "voidedAt" DATETIME,
    "voidedBy" TEXT,
    CONSTRAINT "Payslip_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Payslip_staffId_year_month_key" ON "Payslip"("staffId", "year", "month");
CREATE INDEX "Payslip_year_month_idx" ON "Payslip"("year", "month");
CREATE INDEX "Payslip_voidedAt_idx" ON "Payslip"("voidedAt");

-- CreateTable Holiday
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateTable SalaryChangeLog
CREATE TABLE "SalaryChangeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "oldSalary" REAL,
    "newSalary" REAL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalaryChangeLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SalaryChangeLog_staffId_createdAt_idx" ON "SalaryChangeLog"("staffId", "createdAt");

-- ============================================================================
-- ALTER existing tables — add Payroll columns
-- ============================================================================

-- AlterTable Staff — تواريخ التعيين والإنهاء (للـ pro-rated salary)
ALTER TABLE "Staff" ADD COLUMN "joinedDate" DATETIME;
ALTER TABLE "Staff" ADD COLUMN "terminatedAt" DATETIME;

-- AlterTable Expense — تتبع المسدد من السلف
ALTER TABLE "Expense" ADD COLUMN "paidAmount" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "installmentLimit" REAL;

-- AlterTable SystemSettings — إعدادات الـ payroll engine
ALTER TABLE "SystemSettings" ADD COLUMN "payrollLateGraceMinutes" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "SystemSettings" ADD COLUMN "payrollWorkingDaysPerMonth" INTEGER NOT NULL DEFAULT 26;
ALTER TABLE "SystemSettings" ADD COLUMN "payrollMonthEndDay" INTEGER NOT NULL DEFAULT 28;
ALTER TABLE "SystemSettings" ADD COLUMN "payrollSuggestedLatePerMinute" REAL NOT NULL DEFAULT 2;
