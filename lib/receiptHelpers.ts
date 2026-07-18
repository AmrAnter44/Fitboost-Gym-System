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
    create: { id: 1, current: 1 },
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
 * خطأ تحقق في عملية دفع — بيترجم لـ 400 برسالة واضحة للمستخدم،
 * وبيضمن إن الـ transaction اترولّبكت بالكامل (لا خصم ولا إيصال).
 */
export class PaymentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentValidationError'
  }
}

// أخطاء SQLite/Prisma العابرة اللي إعادة المحاولة بتحلّها:
// P2028 = فشل بدء/انتهاء مهلة الـ transaction، P2034 = تعارض كتابة
function isTransientTxError(error: any): boolean {
  if (error instanceof PaymentValidationError) return false
  const code = error?.code
  if (code === 'P2028' || code === 'P2034') return true
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('database is locked') ||
    msg.includes('database table is locked') ||
    msg.includes('busy') ||
    msg.includes('unable to start a transaction')
}

/**
 * تشغيل عملية دفع كاملة (حجز رقم + تحديث باقي + إنشاء إيصال + نقاط) في
 * transaction واحدة ذرّية — يا إما كله يحصل يا إما ولا حاجة.
 *
 * الـ pool بيشتغل بـ connection_limit=5، فممكن transactions تتزاحم على قفل
 * الكتابة في SQLite وقت الضغط (التقفيل/التقارير). عشان كده:
 * - مهلات أوسع من الافتراضي (maxWait 10s / timeout 20s بدل 2s / 5s)
 * - إعادة محاولة تلقائية (حتى 3 مرات) على الأخطاء العابرة — آمنة لأن
 *   الـ transaction بترولّبك بالكامل قبل ما نعيد
 */
export async function runReceiptTransaction<T>(
  prisma: any,
  fn: (tx: any) => Promise<T>
): Promise<T> {
  let lastError: any
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await prisma.$transaction(fn, { maxWait: 10000, timeout: 20000 })
    } catch (error) {
      lastError = error
      if (!isTransientTxError(error) || attempt === 3) throw error
      await new Promise(resolve => setTimeout(resolve, 250 * attempt))
    }
  }
  throw lastError
}

/**
 * الحصول على رقم الإيصال التالي (للاستخدام مع prisma مباشرة - بدون transaction)
 * يضمن أن رقم الإيصال الجديد دائماً أكبر من جميع الأرقام الموجودة
 *
 * @param prisma - Prisma client
 * @returns رقم الإيصال التالي
 */
export async function getNextReceiptNumberDirect(prisma: any): Promise<number> {
  // ⚠️ نلفّ الخطوات في transaction عشان رقمين متزامنين ما يطلعوش نفس الرقم —
  //    خصوصاً بعد استيراد/استعادة قاعدة لما العداد يبقى أقل من أكبر رقم موجود.
  //    ملحوظة: الـ pool فيه أكتر من connection (connection_limit=5 في .env
  //    و electron/main.js)، فالـ transaction هنا هي اللي بتمنع التكرار،
  //    والعداد بيتحدّث للرقم المحجوز فوراً فالنداء اللي بعده بياخد رقم مختلف.
  return prisma.$transaction(async (tx: any) => {
    const counter = await tx.receiptCounter.upsert({
      where: { id: 1 },
      update: { current: { increment: 1 } },
      create: { id: 1, current: 1 },
    })

    const maxReceipt = await tx.receipt.findFirst({
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true }
    })

    const receiptNumber = Math.max(counter.current, (maxReceipt?.receiptNumber || 0) + 1)

    if (receiptNumber > counter.current) {
      await tx.receiptCounter.update({
        where: { id: 1 },
        data: { current: receiptNumber }
      })
    }

    return receiptNumber
  }, { maxWait: 10000, timeout: 20000 })
}
