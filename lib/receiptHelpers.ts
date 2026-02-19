import { PrismaClient } from '@prisma/client'

/**
 * الحصول على رقم الإيصال التالي (للاستخدام داخل transaction)
 * يضمن أن رقم الإيصال الجديد دائماً أكبر من جميع الأرقام الموجودة
 *
 * @param tx - Prisma transaction client
 * @returns رقم الإيصال التالي
 */
export async function getNextReceiptNumber(tx: any): Promise<number> {
  // جلب العداد الحالي وزيادته
  const counter = await tx.receiptCounter.upsert({
    where: { id: 1 },
    update: { current: { increment: 1 } },
    create: { id: 1, current: 1001 },
  })

  // جلب أكبر رقم إيصال موجود لضمان عدم التكرار
  const maxReceipt = await tx.receipt.findFirst({
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true }
  })

  // استخدام أكبر رقم بين العداد وأكبر رقم إيصال موجود + 1
  const receiptNumber = Math.max(counter.current, (maxReceipt?.receiptNumber || 0) + 1)

  // تحديث العداد إذا كان رقم الإيصال أكبر منه
  if (receiptNumber > counter.current) {
    await tx.receiptCounter.update({
      where: { id: 1 },
      data: { current: receiptNumber }
    })
  }


  return receiptNumber
}

/**
 * الحصول على رقم الإيصال التالي (للاستخدام مع prisma مباشرة - بدون transaction)
 * يضمن أن رقم الإيصال الجديد دائماً أكبر من جميع الأرقام الموجودة
 *
 * @param prisma - Prisma client
 * @returns رقم الإيصال التالي
 */
export async function getNextReceiptNumberDirect(prisma: any): Promise<number> {
  // جلب العداد الحالي وزيادته
  const counter = await prisma.receiptCounter.upsert({
    where: { id: 1 },
    update: { current: { increment: 1 } },
    create: { id: 1, current: 1001 },
  })

  // جلب أكبر رقم إيصال موجود لضمان عدم التكرار
  const maxReceipt = await prisma.receipt.findFirst({
    orderBy: { receiptNumber: 'desc' },
    select: { receiptNumber: true }
  })

  // استخدام أكبر رقم بين العداد وأكبر رقم إيصال موجود + 1
  const receiptNumber = Math.max(counter.current, (maxReceipt?.receiptNumber || 0) + 1)

  // تحديث العداد إذا كان رقم الإيصال أكبر منه
  if (receiptNumber > counter.current) {
    await prisma.receiptCounter.update({
      where: { id: 1 },
      data: { current: receiptNumber }
    })
  }


  return receiptNumber
}
