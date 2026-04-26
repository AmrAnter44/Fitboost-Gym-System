-- AlterTable: إضافة ساعات الدخول المسموح بها للعرض (يتم نسخها للعضو عند الاشتراك)
ALTER TABLE "Offer" ADD COLUMN "allowedCheckInStart" TEXT;
ALTER TABLE "Offer" ADD COLUMN "allowedCheckInEnd" TEXT;
