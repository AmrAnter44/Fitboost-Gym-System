import { prisma } from './prisma'
import { gw, GatewayError, ensureLinked } from './gateway'

/**
 * التحقق من صلاحية الترخيص
 */
export async function validateLicense(): Promise<{ valid: boolean; message: string }> {
  try {
    // جلب السجل من قاعدة البيانات المحلية
    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    // إذا لم يتم تحديد فرع بعد، اسمح بالعمل (للـ OWNER ليختار الفرع)
    if (!license) {
      return {
        valid: true,
        message: 'يرجى اختيار الصالة والفرع من الإعدادات'
      }
    }

    // فحص الترخيص من Control (Gym Gateway) — مع timeout قصير.
    // أي فشل (مفيش نت / الجهاز لسه مش مربوط) → الحالة المحفوظة محلياً (بفترة سماح ١٤ يوم).
    try {
      if (!(license as { gatewayToken?: string | null }).gatewayToken) {
        // جهاز لسه مش مربوط: بيعرّف نفسه لـ Control ويستنى الموافقة
        const linked = await ensureLinked()
        if (!linked) return getCachedLicenseStatus()
      }

      const data = await gw<{ system_license: unknown; gymName?: string; branchName?: string; cloudBackup?: boolean }>(
        'license',
        { timeoutMs: 3000 }
      )

      const current = await prisma.supabaseLicense.findFirst({ orderBy: { lastChecked: 'desc' } })
      if (current) {
        await prisma.supabaseLicense.update({
          where: { id: current.id },
          data: {
            lastChecked: new Date(),
            systemLicense: data?.system_license?.toString() || 'false',
            ...(data?.gymName ? { gymName: data.gymName } : {}),
            ...(data?.branchName ? { branchName: data.branchName } : {}),
          }
        })
      }

      // ☁️ Control بيتحكم في الباك أب السحابي للفرع (لو بعت قيمة)
      if (typeof data?.cloudBackup === 'boolean') {
        const { applyRemoteCloudBackup } = await import('./cloudBackup')
        await applyRemoteCloudBackup(data.cloudBackup).catch((e) =>
          console.error('applyRemoteCloudBackup:', e?.message || e)
        )
      }

      const isValid = data?.system_license === true ||
                      data?.system_license === 'true' ||
                      data?.system_license === 'active'

      return {
        valid: isValid,
        message: isValid
          ? 'الترخيص نشط ✓'
          : 'الترخيص منتهي. يرجى التواصل مع المسؤول.'
      }
    } catch (e) {
      // التوكن اتلغى من Control → نمسحه عشان يتفعّل تاني بكود
      if (e instanceof GatewayError && (e.code === 'REVOKED' || e.code === 'BAD_TOKEN')) {
        await prisma.supabaseLicense.updateMany({ data: { gatewayToken: null } as any }).catch(() => {})
      }
      return getCachedLicenseStatus()
    }
  } catch (error) {
    console.error('Validate license error:', error)
    // في حالة أي خطأ، استخدم الـ cached status بدلاً من إيقاف النظام
    return getCachedLicenseStatus()
  }
}

/**
 * الحصول على حالة الترخيص المحفوظة محلياً (بدون فحص من Supabase)
 */
export async function getCachedLicenseStatus(): Promise<{ valid: boolean; message: string; lastChecked?: Date }> {
  try {
    const license = await prisma.supabaseLicense.findFirst({
      orderBy: { lastChecked: 'desc' }
    })

    // إذا لم يتم تحديد فرع بعد، اسمح بالعمل
    if (!license) {
      return {
        valid: true,
        message: 'يرجى اختيار الصالة والفرع من الإعدادات'
      }
    }

    const isValid = license.systemLicense === 'true' ||
                    license.systemLicense === 'active'

    // 🔒 fail-closed بعد فترة سماح: العمل offline مسموح، لكن لو عدّى 14 يوم من غير
    //    تحقق ناجح من Supabase، نعتبر الترخيص محتاج إعادة تحقق (نمنع العمل بترخيص
    //    محفوظ قديم للأبد). لسه بيسمح بأسبوعين offline كاملين قبل ما يقفل.
    const GRACE_MS = 14 * 24 * 60 * 60 * 1000
    if (isValid && license.lastChecked) {
      const age = Date.now() - new Date(license.lastChecked).getTime()
      if (age > GRACE_MS) {
        return {
          valid: false,
          message: 'انتهت فترة العمل دون اتصال. يرجى الاتصال بالإنترنت للتحقق من الترخيص.',
          lastChecked: license.lastChecked
        }
      }
    }

    return {
      valid: isValid,
      message: isValid
        ? 'الترخيص نشط ✓ (وضع عدم الاتصال)'
        : 'الترخيص منتهي',
      lastChecked: license.lastChecked
    }
  } catch (error) {
    console.error('Get cached license error:', error)
    // في حالة الخطأ، اسمح بالعمل (offline mode) بدلاً من إيقاف النظام
    return {
      valid: true,
      message: 'يعمل في وضع عدم الاتصال (Offline Mode)'
    }
  }
}
