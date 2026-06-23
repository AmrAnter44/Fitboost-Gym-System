-- AlterTable: تاريخ تعيين/تغيير الكوتش للعضو
-- ✅ يستخدم لإشعار الكوتش بـ "عضو جديد اتأسند ليك" حتى في حالة re-assignment
-- (createdAt مش بيتغير لما العضو نفسه قديم بس اتنقل من كوتش لكوتش)
ALTER TABLE "Member" ADD COLUMN "coachAssignedAt" DATETIME;
