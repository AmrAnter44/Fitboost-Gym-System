-- AlterTable Permission — صلاحية الوصول لصفحة تقفيل/حاسبة الـ PT
ALTER TABLE "Permission" ADD COLUMN "canAccessPTCommission" BOOLEAN NOT NULL DEFAULT false;
