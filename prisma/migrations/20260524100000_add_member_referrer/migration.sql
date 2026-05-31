-- AlterTable Member — أضف رقم العضو اللي جاب العضو ده (اختياري، لما source = friend_referral)
ALTER TABLE "Member" ADD COLUMN "referrerMemberNumber" TEXT;
