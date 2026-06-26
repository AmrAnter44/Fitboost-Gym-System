-- AlterTable: إضافة صلاحية رؤية كل الحصص المخصصة + المتابعات
-- ✅ تخلي الـ user (حتى لو دوره COACH) يقدر يشوف كل الـ PT، مش بس عملاءه
ALTER TABLE "Permission" ADD COLUMN "canViewAllPT" BOOLEAN NOT NULL DEFAULT false;
