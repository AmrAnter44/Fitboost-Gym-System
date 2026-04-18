-- Performance indexes for Expense table
CREATE INDEX IF NOT EXISTS "Expense_createdAt_idx" ON "Expense"("createdAt");
CREATE INDEX IF NOT EXISTS "Expense_staffId_idx" ON "Expense"("staffId");
CREATE INDEX IF NOT EXISTS "Expense_type_idx" ON "Expense"("type");
CREATE INDEX IF NOT EXISTS "Expense_isPaid_idx" ON "Expense"("isPaid");

-- Performance indexes for Receipt table
CREATE INDEX IF NOT EXISTS "Receipt_createdAt_idx" ON "Receipt"("createdAt");
CREATE INDEX IF NOT EXISTS "Receipt_type_idx" ON "Receipt"("type");
CREATE INDEX IF NOT EXISTS "Receipt_isCancelled_idx" ON "Receipt"("isCancelled");
CREATE INDEX IF NOT EXISTS "Receipt_memberId_idx" ON "Receipt"("memberId");

-- Performance index for Staff table
CREATE INDEX IF NOT EXISTS "Staff_isActive_idx" ON "Staff"("isActive");

-- Performance indexes for Member table
CREATE INDEX IF NOT EXISTS "Member_isActive_idx" ON "Member"("isActive");
CREATE INDEX IF NOT EXISTS "Member_phone_idx" ON "Member"("phone");
CREATE INDEX IF NOT EXISTS "Member_expiryDate_idx" ON "Member"("expiryDate");

-- Add shift time fields to Staff table
ALTER TABLE "Staff" ADD COLUMN "shiftStartTime" TEXT;
ALTER TABLE "Staff" ADD COLUMN "shiftEndTime" TEXT;
