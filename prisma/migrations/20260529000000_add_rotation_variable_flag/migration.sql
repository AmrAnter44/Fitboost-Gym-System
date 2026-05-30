-- Migration: إضافة خيار "شيفت متغير" على الورديات الأسبوعية
-- بيستخدم في فورم الموظف عشان الـ admin يحدد إن وقت الشيفت بيتغير من يوم للتاني

-- AlterTable Rotation
ALTER TABLE "Rotation" ADD COLUMN "isVariable" BOOLEAN NOT NULL DEFAULT false;
