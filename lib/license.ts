import { supabaseAdmin } from './supabase'
import { prisma } from './prisma'

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

    // محاولة فحص الترخيص من Supabase (مع timeout)
    try {
      // إضافة timeout (5 ثواني)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('License check timeout')), 5000)
      )

      const supabasePromise = supabaseAdmin
        .from('branches')
        .select('system_license')
        .eq('id', license.branchId)
        .single()

      const { data, error } = await Promise.race([
        supabasePromise,
        timeoutPromise
      ]) as any

      // إذا نجح الاتصال، حدّث الـ cache
      if (!error && data) {
        await prisma.supabaseLicense.update({
          where: { id: license.id },
          data: {
            lastChecked: new Date(),
            systemLicense: data?.system_license?.toString() || 'false'
          }
        })

        const isValid = data?.system_license === true ||
                        data?.system_license === 'true' ||
                        data?.system_license === 'active'

        return {
          valid: isValid,
          message: isValid
            ? 'الترخيص نشط ✓'
            : 'الترخيص منتهي. يرجى التواصل مع المسؤول.'
        }
      }

      // إذا فشل الاتصال، استخدم الـ cached status
      // (لا نطبع warning عشان ما نزعجش المستخدم في حالة offline mode)
      return getCachedLicenseStatus()
    } catch (networkError: any) {
      // في حالة network errors (مفيش نت) أو timeout، استخدم الـ cached status
      const errorMessage = networkError?.message || ''
      const isNetworkError =
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('EADDRNOTAVAIL') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout')

      if (isNetworkError) {
        // لا تطبع الخطأ في حالة network error (عشان ما نزعجش المستخدم)
        return getCachedLicenseStatus()
      }

      // خطأ آخر غير network error
      console.error('License check error:', networkError)
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
