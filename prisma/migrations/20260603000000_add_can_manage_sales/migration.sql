-- AlterTable Permission — أضف صلاحية مسؤول السيلز
ALTER TABLE "Permission" ADD COLUMN "canManageSales" BOOLEAN NOT NULL DEFAULT false;
