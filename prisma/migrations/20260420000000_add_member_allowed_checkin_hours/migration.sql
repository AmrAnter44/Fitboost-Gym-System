-- AlterTable: إضافة ساعات الدخول المسموح بها للعضو
ALTER TABLE "Member" ADD COLUMN "allowedCheckInStart" TEXT;
ALTER TABLE "Member" ADD COLUMN "allowedCheckInEnd" TEXT;
