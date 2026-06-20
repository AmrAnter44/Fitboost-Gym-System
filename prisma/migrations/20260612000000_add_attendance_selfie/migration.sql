-- AlterTable Attendance: إضافة صورة السكان للحماية ضد buddy-punching
ALTER TABLE "Attendance" ADD COLUMN "selfieImage" TEXT;

-- AlterTable SystemSettings: toggle لتفعيل/تعطيل ميزة السيلفي
ALTER TABLE "SystemSettings" ADD COLUMN "requireSelfieOnCheckIn" BOOLEAN NOT NULL DEFAULT 0;
