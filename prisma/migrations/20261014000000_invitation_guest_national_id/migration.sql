-- 🪪 الرقم القومي للضيف في الدعوات — الشخص الواحد ليه 3 دعوات بس
ALTER TABLE "Invitation" ADD COLUMN "guestNationalId" TEXT;
CREATE INDEX "Invitation_guestNationalId_idx" ON "Invitation"("guestNationalId");
