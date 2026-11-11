-- 📷 سماح مؤقت (10 دقايق) للعضو يرفع صورته من الأبليكيشن مرة واحدة
ALTER TABLE "Member" ADD COLUMN "photoUploadUntil" DATETIME;
