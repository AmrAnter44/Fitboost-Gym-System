-- AlterTable PT — أضف حقول التجميد
ALTER TABLE "PT" ADD COLUMN "isFrozen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PT" ADD COLUMN "freezeUntil" DATETIME;

-- AlterTable SystemSettings — أضف مفاتيح مميزات PT
ALTER TABLE "SystemSettings" ADD COLUMN "ptFreezeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN "ptUpgradeEnabled" BOOLEAN NOT NULL DEFAULT false;
