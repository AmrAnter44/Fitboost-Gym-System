-- AlterTable: إضافة حقول coach conversion note للـ Member
-- ✅ ملاحظة الكوتش عن سبب عدم اشتراك العضو في PT بعد ما خلصت جلساته المجانية
ALTER TABLE "Member" ADD COLUMN "coachConversionNote" TEXT;
ALTER TABLE "Member" ADD COLUMN "coachConversionNoteAt" DATETIME;
