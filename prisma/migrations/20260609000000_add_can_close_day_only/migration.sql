-- AlterTable Permission — أضف صلاحية اليوم (تقفيل أمس/اليوم/غدا)
ALTER TABLE "Permission" ADD COLUMN "canCloseDayOnly" BOOLEAN NOT NULL DEFAULT false;
