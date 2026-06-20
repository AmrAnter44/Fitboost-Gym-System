-- AlterTable Expense: إضافة طريقة الدفع — لتحديد البنك (cash/instapay/wallet) اللي اتخصم منه المصروف
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'cash';
