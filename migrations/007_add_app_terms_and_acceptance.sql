-- Migration: Terms & conditions shown in the member app on first login
--  SystemSettings.appTerms      — نص الشروط (فاضي = بيستخدم receiptTerms)
--  Member.termsAcceptedAt       — وقت موافقة العضو
-- Safe: migration runner skips "column already exists" errors

ALTER TABLE "SystemSettings" ADD COLUMN "appTerms" TEXT;
ALTER TABLE "Member" ADD COLUMN "termsAcceptedAt" DATETIME;
