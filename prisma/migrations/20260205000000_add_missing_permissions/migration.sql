-- Add missing permission columns to Permission table

-- PT Attendance Permission
ALTER TABLE "Permission" ADD COLUMN "canRegisterPTAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Nutrition Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewNutrition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateNutrition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditNutrition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteNutrition" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canRegisterNutritionAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Physiotherapy Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewPhysiotherapy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreatePhysiotherapy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditPhysiotherapy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeletePhysiotherapy" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canRegisterPhysioAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Group Class Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewGroupClass" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateGroupClass" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditGroupClass" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteGroupClass" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canRegisterClassAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Delete Staff Permission
ALTER TABLE "Permission" ADD COLUMN "canDeleteStaff" BOOLEAN NOT NULL DEFAULT false;

-- Expense Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewExpenses" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateExpense" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditExpense" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteExpense" BOOLEAN NOT NULL DEFAULT false;

-- Visitor Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewVisitors" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateVisitor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditVisitor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteVisitor" BOOLEAN NOT NULL DEFAULT false;

-- Follow Up Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewFollowUps" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateFollowUp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditFollowUp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteFollowUp" BOOLEAN NOT NULL DEFAULT false;

-- Day Use Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewDayUse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateDayUse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditDayUse" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canDeleteDayUse" BOOLEAN NOT NULL DEFAULT false;

-- Attendance Permission
ALTER TABLE "Permission" ADD COLUMN "canViewAttendance" BOOLEAN NOT NULL DEFAULT false;

-- Closing Permission
ALTER TABLE "Permission" ADD COLUMN "canAccessClosing" BOOLEAN NOT NULL DEFAULT false;

-- Admin Permission
ALTER TABLE "Permission" ADD COLUMN "canAccessAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Fitness Test Permissions
ALTER TABLE "Permission" ADD COLUMN "canCreateFitnessTest" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canViewFitnessTests" BOOLEAN NOT NULL DEFAULT false;

-- SPA Permissions
ALTER TABLE "Permission" ADD COLUMN "canViewSpaBookings" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCreateSpaBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canEditSpaBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canCancelSpaBooking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Permission" ADD COLUMN "canViewSpaReports" BOOLEAN NOT NULL DEFAULT false;
