/*
  Warnings:

  - A unique constraint covering the columns `[staffCode]` on the table `Staff` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "staffCode" INTEGER;

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "staffId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME,
    "duration" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attendance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Attendance_staffId_idx" ON "Attendance"("staffId");

-- CreateIndex
CREATE INDEX "Attendance_checkIn_idx" ON "Attendance"("checkIn");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffCode_key" ON "Staff"("staffCode");
