-- 🧑‍🏫 مين بيقدّم الكلاس: موظف (كابتن الجيم أو كابتن من برا اتعمله حساب موظف) + تليفونه
ALTER TABLE "ClassSchedule" ADD COLUMN "instructorStaffId" TEXT;
ALTER TABLE "ClassSchedule" ADD COLUMN "instructorPhone" TEXT;
