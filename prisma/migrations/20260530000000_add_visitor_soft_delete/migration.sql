-- Migration: حذف منطقي (soft delete) للزائر
-- الزائر مش بيتحذف نهائي عشان متابعاته (FollowUps) تفضل في الـ DB
-- حتى لو الشخص بقى عضو والـ admin حذف الـ visitor record

-- AlterTable Visitor
ALTER TABLE "Visitor" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Visitor" ADD COLUMN "deletedAt" DATETIME;

-- Index للفلتر السريع في الـ GET endpoints
CREATE INDEX "Visitor_isDeleted_idx" ON "Visitor"("isDeleted");
