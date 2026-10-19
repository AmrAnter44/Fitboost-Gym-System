import { PrismaClient } from '@prisma/client'
import { headers } from 'next/headers'
import { verifyAuth } from './auth'
import { createAuditLog } from './auditLog'

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
  // P1008 = SQLite رجّع SQLITE_BUSY (كاتب تاني ماسك الداتابيز) — ده أشهر خطأ وقت
  //         إن اتنين يدفعوا في نفس اللحظة، ومكانش بيتعاد قبل كده
  if (code === 'P2028' || code === 'P2034' || code === 'P1008') return true
  const msg = String(error?.message || '').toLowerCase()
  return msg.includes('database is locked') ||
    msg.includes('operations timed out') ||
    msg.includes('database table is locked') ||
    msg.includes('busy') ||
    msg.includes('unable to start a transaction')
}

// 🔒 طابور داخل السيرفر لعمليات الإيصالات: SQLite بيسمح بكاتب واحد بس، والـ transactions
//    بتاعة Prisma بتبدأ "deferred" — فلو اتنين كاشير دفعوا في نفس اللحظة بيتصادموا
//    (SQLITE_BUSY → P1008) بدل ما يستنوا. كل الشاشات بتكلّم نفس السيرفر، فالطابور ده
//    بيخلّيهم ياخدوا دورهم واحد ورا التاني. متخزّن على globalThis عشان يبقى نسخة واحدة
//    حتى لو الموديول اتحمّل أكتر من مرة (dev / chunks).
const receiptQueueHolder = globalThis as unknown as { __fitboostReceiptQueue?: Promise<unknown> }

function withReceiptQueue<T>(task: () => Promise<T>): Promise<T> {
  const previous = receiptQueueHolder.__fitboostReceiptQueue || Promise.resolve()
  const run = previous.then(task, task)
  // الطابور مايقفش لو عملية فشلت
  receiptQueueHolder.__fitboostReceiptQueue = run.catch(() => undefined)
  return run
}

// ==================== 🧾 سجل محاولات إنشاء الإيصالات (للأونر) ====================
// كل عملية إيصال — نجحت أو فشلت — بتتسجل في AuditLog بـ action = RECEIPT_CREATE وبتظهر
// للأونر بس في «سجل الأحداث». الغرض: لما إيصال ميطلعش نعرف مين/إمتى/منين والخطأ إيه بالظبط.

type TrackedReceipt = {
  id?: string
  receiptNumber?: number
  type?: string
  amount?: number
  paymentMethod?: string
  staffName?: string
  name?: string
}

export type ReceiptRequestContext = { cookie?: string; page?: string; ipAddress?: string; userAgent?: string }

// بيانات الطلب الحالي (اليوزر/الصفحة) من غير ما كل route يبعتها — لازم تتنده جوّه الـ request نفسه
export function captureReceiptRequestContext(): ReceiptRequestContext {
  try {
    const h = headers()
    let page: string | undefined
    try { const ref = h.get('referer'); if (ref) page = new URL(ref).pathname } catch {}
    return {
      cookie: h.get('cookie') || undefined,
      page,
      ipAddress: (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || undefined,
      userAgent: h.get('user-agent') || undefined,
    }
  } catch {
    return {} // برّه request (سكريبت/كرون)
  }
}

function describeReceiptData(data: any): TrackedReceipt {
  const entry: TrackedReceipt = {
    receiptNumber: data?.receiptNumber,
    type: data?.type,
    amount: typeof data?.amount === 'number' ? data.amount : undefined,
    paymentMethod: typeof data?.paymentMethod === 'string' ? data.paymentMethod : undefined,
    staffName: data?.staffName || undefined,
  }
  try {
    const item = typeof data?.itemDetails === 'string' && data.itemDetails.trim().startsWith('{') ? JSON.parse(data.itemDetails) : null
    if (item) {
      entry.name = item.memberName || item.clientName || item.name || undefined
      if (!entry.staffName && item.staffName) entry.staffName = item.staffName
    } else if (typeof data?.itemDetails === 'string') {
      entry.name = data.itemDetails.slice(0, 80)
    }
  } catch {}
  return entry
}

// بيلفّ الـ tx عشان يلقط أي tx.receipt.create بيحصل جوّه العملية (البيانات قبل، والرقم/الـ id بعد)
function trackReceiptCreates(tx: any, tracked: TrackedReceipt[]): any {
  return new Proxy(tx, {
    get(target, prop) {
      const value = target[prop]
      if (prop !== 'receipt' || !value) return value
      return new Proxy(value, {
        get(model, method) {
          const original = model[method]
          if (method !== 'create' || typeof original !== 'function') return original
          return async (args: any) => {
            const entry = describeReceiptData(args?.data)
            tracked.push(entry)
            const created = await original.call(model, args)
            entry.id = created?.id
            entry.receiptNumber = created?.receiptNumber ?? entry.receiptNumber
            return created
          }
        },
      })
    },
  })
}

// تفسير بسيط لأشهر الأخطاء عشان الأونر يفهمها من غير مبرمج
function explainReceiptError(error: any): string {
  if (error instanceof PaymentValidationError) return 'بيانات الدفع اترفضت (تحقق) — مفيش حاجة اتسجلت'
  const code = error?.code
  const msg = String(error?.message || '').toLowerCase()
  if (code === 'P2002') return 'قيمة مكررة (غالباً رقم إيصال أو رقم عضوية/تليفون موجود قبل كده)'
  if (code === 'P2003') return 'ربط ببيانات مش موجودة (عضو/موظف/اشتراك اتمسح أو رقمه غلط)'
  if (code === 'P2025') return 'السجل المطلوب تعديله مش موجود (اتمسح أو اتغيّر)'
  if (code === 'P1008' || msg.includes('database is locked') || msg.includes('busy')) return 'الداتابيز كانت مشغولة بعملية تانية وقت الدفع — حاول تاني'
  if (code === 'P2028' || code === 'P2034' || msg.includes('timed out')) return 'العملية خدت وقت أطول من المسموح (ضغط على السيستم) — حاول تاني'
  if (msg.includes('no such column') || msg.includes('no such table') || code === 'P2021' || code === 'P2022') return 'الداتابيز ناقصها تحديث (migration) — محتاجة تحديث السيستم'
  if (msg.includes('unknown arg') || msg.includes('invalid') || code === 'P2009' || code === 'P2012') return 'بيانات ناقصة أو نوعها غلط اتبعتت للسيستم'
  return 'خطأ غير متوقع — ابعت التفاصيل دي للدعم'
}

/**
 * تسجيل نتيجة محاولة إيصال في سجل الأحداث. مابترميش خطأ أبداً ومابتوقفش العملية الأصلية.
 */
export async function logReceiptAttempt(input: {
  context: ReceiptRequestContext
  receipts?: TrackedReceipt[]
  error?: any
  attempts?: number
  durationMs?: number
}): Promise<void> {
  try {
    const { context, error } = input
    const receipts = input.receipts || []
    let user: any = null
    if (context.cookie) {
      const cookie = context.cookie
      user = await verifyAuth({ headers: { get: (key: string) => (key.toLowerCase() === 'cookie' ? cookie : null) } } as any).catch(() => null)
    }
    const base = {
      userId: user?.userId, userEmail: user?.email, userName: user?.name, userRole: user?.role,
      action: 'RECEIPT_CREATE' as const, resource: 'Receipt' as const,
      ipAddress: context.ipAddress, userAgent: context.userAgent,
    }
    const common: Record<string, any> = { page: context.page }
    if (input.attempts && input.attempts > 1) common.attempts = input.attempts
    if (typeof input.durationMs === 'number') common.durationMs = input.durationMs
    const describe = (r?: TrackedReceipt) => r ? {
      receiptNumber: r.receiptNumber, receiptType: r.type, memberName: r.name, amount: r.amount,
      paymentMethod: r.paymentMethod, staffName: r.staffName,
    } : {}

    if (error) {
      const validation = error instanceof PaymentValidationError
      const created = receipts.filter(r => r.id)
      const pending = receipts.find(r => !r.id)
      const failedStep = pending
        ? 'وقت حفظ الإيصال نفسه'
        : created.length > 0
          ? 'بعد حفظ الإيصال (نقاط/تحديثات) — الإيصال اتلغى مع العملية'
          : 'قبل الوصول للإيصال (حفظ/تحديث بيانات الاشتراك)'
      const rawMessage = String(error?.message || error || '').replace(/\s+/g, ' ').trim()
      await createAuditLog({
        ...base,
        status: validation ? 'warning' : 'failure',
        errorMessage: ((error?.code ? '[' + error.code + '] ' : '') + rawMessage).slice(0, 1500),
        details: {
          ...describe(pending || created[created.length - 1]),
          ...common,
          failedStep,
          explanation: explainReceiptError(error),
          errorCode: error?.code,
          errorName: error?.name,
          errorMeta: error?.meta ? JSON.stringify(error.meta).slice(0, 400) : undefined,
        },
      })
      return
    }

    for (const r of receipts) {
      await createAuditLog({ ...base, status: 'success', resourceId: r.id, details: { ...describe(r), ...common } })
    }
  } catch (logError) {
    console.error('❌ Failed to log receipt attempt:', logError instanceof Error ? logError.message : logError)
  }
}

/**
 * تشغيل عملية دفع كاملة (حجز رقم + تحديث باقي + إنشاء إيصال + نقاط) في
 * transaction واحدة ذرّية — يا إما كله يحصل يا إما ولا حاجة.
 *
 * الـ pool بيشتغل بـ connection_limit=5، فممكن transactions تتزاحم على قفل
 * الكتابة في SQLite وقت الضغط (التقفيل/التقارير). عشان كده:
 * - مهلات أوسع من الافتراضي (maxWait 10s / timeout 20s بدل 2s / 5s)
 * - طابور داخل السيرفر (withReceiptQueue) عشان الإيصالات المتزامنة ماتتصادمش
 * - إعادة محاولة تلقائية (حتى 6 مرات) على الأخطاء العابرة (P1008/P2028/P2034) — آمنة لأن
 *   الـ transaction بترولّبك بالكامل قبل ما نعيد
 */
export async function runReceiptTransaction<T>(
  prisma: any,
  fn: (tx: any) => Promise<T>,
  options?: { maxWait?: number; timeout?: number }
): Promise<T> {
  // options اختيارية — للمسارات اللي كان ليها مهلات أطول من الافتراضي (زي 60 ثانية)
  const txOptions = { maxWait: 10000, timeout: 20000, ...(options || {}) }
  let lastError: any
  const MAX_ATTEMPTS = 6
  //  🧾 سجل محاولات الإيصالات: بنلقط سياق الطلب دلوقتي (واحنا لسه جوّه الـ request)
  const context = captureReceiptRequestContext()
  const startedAt = Date.now()
  const report = (attempts: number, receipts: TrackedReceipt[], error?: any) => {
    //  في نفس طابور الإيصالات عشان كتابة السجل ماتتصادمش مع إيصال تاني، ومن غير await
    void withReceiptQueue(() => logReceiptAttempt({ context, receipts, error, attempts, durationMs: Date.now() - startedAt }))
  }
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const tracked: TrackedReceipt[] = []
    try {
      const result = await withReceiptQueue(() => prisma.$transaction((tx: any) => fn(trackReceiptCreates(tx, tracked)), txOptions))
      report(attempt, tracked)
      return result as T
    } catch (error) {
      lastError = error
      if (!isTransientTxError(error) || attempt === MAX_ATTEMPTS) {
        report(attempt, tracked, error)
        throw error
      }
      // انتظار متزايد + عشوائية بسيطة عشان المحاولات المتزامنة ماتتصادمش تاني في نفس اللحظة
      await new Promise(resolve => setTimeout(resolve, 300 * attempt + Math.floor(Math.random() * 300)))
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
