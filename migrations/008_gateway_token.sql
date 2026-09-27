-- Migration: ربط الجهاز بـ Control (Gym Gateway) بدل مفاتيح Supabase
--  SupabaseLicense.gatewayToken — توكن الجهاز الخاص بالفرع
-- Safe: migration runner skips "column already exists" errors

ALTER TABLE "SupabaseLicense" ADD COLUMN "gatewayToken" TEXT;
