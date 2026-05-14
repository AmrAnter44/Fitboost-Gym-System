-- AlterTable: إضافة معرف الباقة على العضو لتطبيق المميزات لاحقاً
ALTER TABLE "Member" ADD COLUMN "offerId" TEXT;

-- Index على عمود الباقة لتسريع البحث في زرار "تطبيق مميزات الباقات"
CREATE INDEX "Member_offerId_idx" ON "Member"("offerId");
