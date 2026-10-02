-- 📍 الحضور الذكي (FB Team): مقفول افتراضياً — الطريقة القديمة مش بتتأثر
ALTER TABLE "SystemSettings" ADD COLUMN "smartAttendanceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SystemSettings" ADD COLUMN "smartAttendanceRadiusM" INTEGER NOT NULL DEFAULT 150;
ALTER TABLE "SystemSettings" ADD COLUMN "branchLat" REAL;
ALTER TABLE "SystemSettings" ADD COLUMN "branchLng" REAL;
