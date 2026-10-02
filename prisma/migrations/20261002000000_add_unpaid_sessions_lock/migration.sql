-- 🔒 حد الحصص لحد دفع الباقي (PT / تغذية / علاج طبيعي / مزيد)
--    لو على الاشتراك باقي والحصص الباقية وصلت للرقم ده أو أقل → تسجيل الحصص يتقفل لحد ما الباقي يتدفع
ALTER TABLE "PT" ADD COLUMN "unpaidSessionsLockAt" INTEGER;
ALTER TABLE "Nutrition" ADD COLUMN "unpaidSessionsLockAt" INTEGER;
ALTER TABLE "Physiotherapy" ADD COLUMN "unpaidSessionsLockAt" INTEGER;
ALTER TABLE "More" ADD COLUMN "unpaidSessionsLockAt" INTEGER;
