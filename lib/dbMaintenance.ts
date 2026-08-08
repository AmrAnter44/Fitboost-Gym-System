// ==========================================
// صيانة يومية تلقائية للداتابيز — بتمنع الجداول اللوجية/المؤقتة من التضخم للأبد
// من غيرها الداتابيز بتكبر باستمرار (خصوصًا SyncQueue و WhatsAppQueue اللي
// بيخزن الميديا base64) والجهاز بيبقى محتاج ترقية كل ما الداتا تزيد.
// بتتنده من instrumentation.ts مرة كل 24 ساعة — كل عمليات الحذف idempotent ورخيصة.
// ==========================================

import { prisma } from './prisma'

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS)
}

// سياسة الاحتفاظ — متعمدة تكون محافظة:
// - بيانات الأعضاء والفلوس (Member/Receipt/CheckIn...) عمرها ما بتتمسح من هنا
// - اللي بيتمسح بس: سجلات لوج/طوابير خلّصت وظيفتها
const RETENTION = {
  syncQueueSentDays: 7, // إيصالات اتبعتت لـ Supabase — الـ payload نسخة مكررة من Receipt
  whatsappQueueDoneDays: 30, // رسايل اتبعتت/اتلغت — mediaBase64 بياخد مساحة كبيرة
  errorLogDays: 90,
  activityLogDays: 180,
  auditLogDays: 365, // سنة كاملة للمراجعة المالية
  activeSessionDays: 90, // سجل تسجيلات الدخول القديمة
}

export interface MaintenanceResult {
  ran: boolean
  deleted: Record<string, number>
  error?: string
}

let lastRunAt = 0

/** بتشغّل التنظيف مرة كل 24 ساعة على الأكثر — الاستدعاءات الزيادة no-op */
export async function runDbMaintenanceIfDue(): Promise<MaintenanceResult> {
  if (Date.now() - lastRunAt < DAY_MS) {
    return { ran: false, deleted: {} }
  }
  lastRunAt = Date.now()
  return runDbMaintenance()
}

export async function runDbMaintenance(): Promise<MaintenanceResult> {
  const deleted: Record<string, number> = {}
  try {
    // 1) طابور مزامنة Supabase — العناصر المتبعتة بتفضل ومعاها JSON snapshot كامل
    const syncQueue = await prisma.syncQueueItem.deleteMany({
      where: {
        status: 'sent',
        createdAt: { lt: daysAgo(RETENTION.syncQueueSentDays) },
      },
    })
    deleted.syncQueue = syncQueue.count

    // 2) طابور الواتساب — الرسايل المتبعتة/الملغية (mediaBase64 ممكن يبقى ميجابايتس للرسالة)
    const waQueue = await prisma.whatsAppQueueItem.deleteMany({
      where: {
        status: { in: ['sent', 'cancelled', 'failed'] },
        createdAt: { lt: daysAgo(RETENTION.whatsappQueueDoneDays) },
      },
    })
    deleted.whatsappQueue = waQueue.count

    // 3) لوج الأخطاء
    const errorLog = await prisma.errorLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.errorLogDays) } },
    })
    deleted.errorLog = errorLog.count

    // 4) لوج النشاط
    const activityLog = await prisma.activityLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.activityLogDays) } },
    })
    deleted.activityLog = activityLog.count

    // 5) لوج المراجعة — بنسيب سنة كاملة
    const auditLog = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: daysAgo(RETENTION.auditLogDays) } },
    })
    deleted.auditLog = auditLog.count

    // 6) الجلسات: القديمة اللي لسه معلّمة active بتتقفل، والأقدم من 90 يوم بتتمسح
    await prisma.activeSession.updateMany({
      where: { isActive: true, lastActivityAt: { lt: daysAgo(7) } },
      data: { isActive: false },
    })
    const sessions = await prisma.activeSession.deleteMany({
      where: { lastActivityAt: { lt: daysAgo(RETENTION.activeSessionDays) } },
    })
    deleted.activeSessions = sessions.count

    const total = Object.values(deleted).reduce((s, n) => s + n, 0)
    if (total > 0) {
      console.log('[dbMaintenance] cleaned:', JSON.stringify(deleted))
    }

    // 7) استرجاع المساحة — الحذف في SQLite بيسيب صفحات فاضية جوه الملف
    //    من غير VACUUM الملف عمره ما يصغر (مهم أول مرة بعد تنضيف WhatsApp mediaBase64)
    await vacuumIfWorthIt()

    return { ran: true, deleted }
  } catch (err: any) {
    console.error('[dbMaintenance] error:', err?.message || err)
    return { ran: true, deleted, error: err?.message || String(err) }
  }
}

// عتبات الـ VACUUM: بيشتغل بس لما المساحة الفاضية جوه الملف تستاهل
// (أكتر من 10MB و15% من الملف) — فعمليًا بيحصل نادرًا، مش كل يوم
const VACUUM_MIN_FREE_BYTES = 10 * 1024 * 1024
const VACUUM_MIN_FREE_RATIO = 0.15

async function pragmaNumber(name: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`PRAGMA ${name}`)
  const value = rows?.[0]?.[name]
  return typeof value === 'bigint' ? Number(value) : Number(value ?? 0)
}

async function vacuumIfWorthIt(): Promise<void> {
  try {
    const [pageCount, freeCount, pageSize] = await Promise.all([
      pragmaNumber('page_count'),
      pragmaNumber('freelist_count'),
      pragmaNumber('page_size'),
    ])
    if (!pageCount || !pageSize) return

    const freeBytes = freeCount * pageSize
    const freeRatio = freeCount / pageCount
    if (freeBytes < VACUUM_MIN_FREE_BYTES || freeRatio < VACUUM_MIN_FREE_RATIO) return

    console.log(
      `[dbMaintenance] VACUUM: reclaiming ~${(freeBytes / 1024 / 1024).toFixed(1)}MB (${Math.round(freeRatio * 100)}% of file)`
    )
    // VACUUM بياخد write lock لثواني — بيحصل مع الـ tick الصباحي مش وسط الشغل،
    // و busy_timeout=10s مظبوط فأي طلب متزامن هيستنى مش هيفشل
    await prisma.$executeRawUnsafe('VACUUM')
    await prisma.$executeRawUnsafe('PRAGMA wal_checkpoint(TRUNCATE)')
    console.log('[dbMaintenance] VACUUM done')
  } catch (err: any) {
    // مش fatal — هيتحاول تاني في الدورة الجاية
    console.error('[dbMaintenance] VACUUM skipped:', err?.message || err)
  }
}
