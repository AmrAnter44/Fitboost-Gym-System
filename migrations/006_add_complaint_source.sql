-- Migration: Track where a complaint came from (staff desk vs. member app)
-- Needed so the complaints page can flag complaints submitted from the mobile app.
-- Safe: migration runner skips "column already exists" errors

ALTER TABLE "Complaint" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'staff';
