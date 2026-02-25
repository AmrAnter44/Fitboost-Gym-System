import { createFreshSupabaseClient } from './supabase'
import { prisma } from './prisma'

interface LicenseValidation {
  valid: boolean
  message: string
}

/**
 * Validates license by checking Supabase database
 * Fetches branch data and checks system_license field
 *
 * ⚠️ TEMPORARILY DISABLED - Always returns valid: true
 */
export async function validateLicense(): Promise<LicenseValidation> {
  // ⚠️ نظام الترخيص معطل مؤقتاً - النظام مفتوح دائماً
  console.log('⚠️ [LICENSE] System check DISABLED - Always returning valid: true')
  return {
    valid: true,
    message: 'نظام الترخيص معطل مؤقتاً - النظام مفتوح'
  }

  /* ===== ORIGINAL CODE (COMMENTED OUT) =====
  try {
    // جلب السجل من قاعدة البيانات المحلية
    const localLicense = await prisma.supabaseLicense.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    // إذا لم يتم اختيار صالة وفرع بعد (first run)
    // ✅ نسمح للنظام بالعمل حتى يتم الاختيار
    if (!localLicense) {
      return {
        valid: true, // ✅ السماح بالعمل
        message: 'لم يتم اختيار الصالة والفرع بعد - يرجى الاختيار من الإعدادات'
      }
    }

    // فحص الترخيص من Supabase
    try {
      const checkTimestamp = new Date().toISOString()
      console.log('🔍 [LICENSE] ===== START CHECK =====')
      console.log('🔍 [LICENSE] Timestamp:', checkTimestamp)
      console.log('🔍 [LICENSE] Checking branch:', {
        branchId: localLicense.branchId,
        branchName: localLicense.branchName,
        cachedSystemLicense: localLicense.systemLicense,
        lastChecked: localLicense.lastChecked
      })

      // ✅ إنشاء fresh Supabase client لتجنب caching
      const supabase = createFreshSupabaseClient()
      console.log('✅ [LICENSE] Created fresh Supabase client (no cache)')

      const { data, error } = await supabase
        .from('branches')
        .select('system_license')
        .eq('id', localLicense.branchId)
        .single()

      console.log('📡 [LICENSE] Supabase response:', {
        data,
        error,
        timestamp: new Date().toISOString()
      })

      if (error) {
        // ⚠️ خطأ في الاتصال أو الفرع غير موجود
        // نسمح بالعمل عشان ميقفلش بالغلط (ممكن يكون مفيش انترنت)
        console.warn('⚠️ [LICENSE] Error - allowing system to work:', error.message)
        return {
          valid: true, // ✅ السماح بالعمل لو مفيش اتصال
          message: 'لم يتم التحقق من الترخيص - لا يوجد اتصال بالإنترنت'
        }
      }

      // التحقق من قيمة system_license
      const isValid = data.system_license === true ||
                     data.system_license === 'true' ||
                     data.system_license === 'active'

      console.log('✅ [LICENSE] Validation result:', {
        system_license: data.system_license,
        type: typeof data.system_license,
        isValid,
        willLock: !isValid
      })

      const message = isValid
        ? 'الترخيص صالح'
        : 'الترخيص غير صالح - النظام معطل'

      // ✅ تحديث lastChecked في قاعدة البيانات
      const updateTimestamp = new Date()
      console.log('💾 [LICENSE] Updating local DB with systemLicense =', String(data.system_license))

      const updatedLicense = await prisma.supabaseLicense.update({
        where: { id: localLicense.id },
        data: {
          lastChecked: updateTimestamp,
          systemLicense: String(data.system_license)
        }
      })

      console.log('💾 [LICENSE] Local DB updated:', {
        id: updatedLicense.id,
        systemLicense: updatedLicense.systemLicense,
        lastChecked: updatedLicense.lastChecked
      })

      console.log(isValid ? '✅ [LICENSE] System UNLOCKED =====' : '🔒 [LICENSE] System LOCKED =====')

      return { valid: isValid, message }

    } catch (supabaseError) {
      // ⚠️ خطأ غير متوقع - نسمح بالعمل عشان ميقفلش بالغلط
      console.warn('⚠️ Unexpected error checking license:', supabaseError)
      return {
        valid: true, // ✅ السماح بالعمل
        message: 'لم يتم التحقق من الترخيص - خطأ في الاتصال'
      }
    }

  } catch (error) {
    console.error('❌ License validation error:', error)
    return {
      valid: false,
      message: 'خطأ في فحص الترخيص - يرجى المحاولة مرة أخرى'
    }
  }
  ===== END COMMENTED CODE ===== */
}

/**
 * Gets cached license status from local database (fast read, no Supabase call)
 * Used for client-side display
 */
export async function getCachedLicenseStatus(): Promise<{
  valid: boolean
  lastChecked: Date | null
  gymName: string | null
  branchName: string | null
  message: string | null
}> {
  try {
    const localLicense = await prisma.supabaseLicense.findFirst({
      orderBy: { updatedAt: 'desc' }
    })

    if (!localLicense) {
      return {
        valid: true, // ✅ السماح بالعمل قبل اختيار الصالة والفرع
        lastChecked: null,
        gymName: null,
        branchName: null,
        message: 'لم يتم اختيار الصالة والفرع'
      }
    }

    const isValid = localLicense.systemLicense === 'true' ||
                   localLicense.systemLicense === 'active'

    return {
      valid: isValid,
      lastChecked: localLicense.lastChecked,
      gymName: localLicense.gymName,
      branchName: localLicense.branchName,
      message: localLicense.licenseMessage
    }
  } catch (error) {
    console.error('Error getting cached license status:', error)
    return {
      valid: false,
      lastChecked: null,
      gymName: null,
      branchName: null,
      message: 'خطأ في قراءة حالة الترخيص'
    }
  }
}

/**
 * Server-side guard function for API routes
 * Throws error if license is invalid, blocking the request
 *
 * ⚠️ هذه الدالة تقفل النظام بالكامل إذا كان الترخيص غير صالح
 *
 * Usage in API routes:
 * await requireValidLicense()
 */
export async function requireValidLicense(): Promise<void> {
  const result = await validateLicense()

  if (!result.valid) {
    console.error('🚫 License check FAILED -', result.message)
    throw new Error(result.message)
  }
}
