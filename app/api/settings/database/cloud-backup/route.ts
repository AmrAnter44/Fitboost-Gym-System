import { NextResponse } from 'next/server'
import { verifyAuth } from '../../../../../lib/auth'
import { prisma } from '../../../../../lib/prisma'
import {
  isCloudBackupConfigured,
  cloudBackupEnv,
  runCloudBackup,
  runPhotosBackup,
  getPhotosBackupStatus,
  type CloudBackupResult,
} from '../../../../../lib/cloudBackup'

export const dynamic = 'force-dynamic'

/**
 * ☁️ API التحكّم في النسخ الاحتياطي السحابي (Backblaze B2)
 *   GET   → حالة الإعداد (مفعّل؟ متظبط؟ آخر رفعة/خطأ)
 *   POST  { action: 'toggle', enabled }  → تفعيل/إقفال
 *   POST  { action: 'upload-now' }        → رفع نسخة فورية (اختبار)
 */

// النسخ الاحتياطي السحابي للأونر فقط — مش مجرد إخفاء في الواجهة
async function requireOwner(request: Request) {
  const user = await verifyAuth(request)
  if (!user) throw new Error('Unauthorized')
  if (user.role !== 'OWNER') throw new Error('Forbidden')
  return user
}

// رسائل عربية واضحة لكل نتيجة رفع
function messageFor(result: CloudBackupResult): string {
  if (result.ok) return 'تم رفع النسخة الاحتياطية للسحابة بنجاح'
  switch (result.reason) {
    case 'not-configured':
      return 'متغيرات B2 مش متظبطة في ملف الـ env (B2_KEY_ID / B2_APPLICATION_KEY / B2_BUCKET_ID)'
    case 'no-license':
      return 'مفيش بيانات ترخيص (gymId/branchId) — فعّل الترخيص الأول'
    case 'disabled':
      return 'النسخ الاحتياطي السحابي مقفول'
    default:
      return `فشل الرفع للسحابة: ${result.error || 'خطأ غير معروف'}`
  }
}

export async function GET(request: Request) {
  try {
    await requireOwner(request)

    const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } })
    const license = await prisma.supabaseLicense.findFirst({ orderBy: { lastChecked: 'desc' } })
    const env = cloudBackupEnv()

    return NextResponse.json({
      enabled: Boolean(settings?.cloudBackupEnabled),
      configured: isCloudBackupConfigured(),
      bucketName: env.bucketName,
      gymConfigured: Boolean(license?.gymId && license?.branchId),
      gymName: license?.gymName ?? null,
      branchName: license?.branchName ?? null,
      lastCloudBackupAt: settings?.lastCloudBackupAt ?? null,
      lastCloudBackupError: settings?.lastCloudBackupError ?? null,
      lastCloudBackupSize: settings?.lastCloudBackupSize ?? null,
      photos: getPhotosBackupStatus(),
    })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error?.message?.includes?.('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول للإعدادات' }, { status: 403 })
    }
    console.error('cloud-backup GET error:', error?.message || 'unknown')
    return NextResponse.json({ error: 'فشل جلب حالة النسخ السحابي' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireOwner(request)
    const body = await request.json().catch(() => ({}))
    const action = body?.action

    if (action === 'toggle') {
      const enabled = Boolean(body?.enabled)

      // منع التفعيل لو الإعداد ناقص — عشان المستخدم ميفتكرش إنه شغّال وهو لأ
      if (enabled && !isCloudBackupConfigured()) {
        return NextResponse.json(
          {
            success: false,
            error:
              'مش هينفع تفعّل الرفع السحابي قبل ما تظبط متغيرات B2 في ملف الـ env وتعيد تشغيل السيرفر.',
          },
          { status: 400 },
        )
      }

      const settings = await prisma.systemSettings.upsert({
        where: { id: 'singleton' },
        update: { cloudBackupEnabled: enabled, updatedBy: user.userId },
        create: { id: 'singleton', cloudBackupEnabled: enabled, updatedBy: user.userId },
      })

      return NextResponse.json({ success: true, enabled: settings.cloudBackupEnabled })
    }

    if (action === 'upload-now') {
      // رفع فوري للاختبار — بيتجاهل فحص "مفعّل؟" بس لازم يكون متظبط
      const result = await runCloudBackup({ force: true })
      // ومعاه دفعة صور تزايدية (الجديد بس) — عشان زرار واحد يختبر الاتنين
      const photos = result.ok ? await runPhotosBackup({ force: true }) : null
      const settings = await prisma.systemSettings.findUnique({ where: { id: 'singleton' } })

      let message = messageFor(result)
      if (photos?.ok && (photos.uploaded || 0) > 0) {
        message += ` + اترفعت ${photos.uploaded} صورة جديدة${(photos.remaining || 0) > 0 ? ` (باقي ${photos.remaining} للدورة الجاية)` : ''}`
      }

      return NextResponse.json(
        {
          success: result.ok,
          message,
          remoteName: result.ok ? result.remoteName : null,
          size: result.ok ? result.size : null,
          photos,
          lastCloudBackupAt: settings?.lastCloudBackupAt ?? null,
          lastCloudBackupError: settings?.lastCloudBackupError ?? null,
        },
        { status: result.ok ? 200 : 400 },
      )
    }

    return NextResponse.json({ success: false, error: 'action غير معروف' }, { status: 400 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (error?.message?.includes?.('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل الإعدادات' }, { status: 403 })
    }
    console.error('cloud-backup POST error:', error?.message || 'unknown')
    return NextResponse.json({ error: 'فشل تنفيذ العملية' }, { status: 500 })
  }
}
