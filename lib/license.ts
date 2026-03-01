import { supabase } from './supabase'
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

    // فحص الترخيص من Supabase
    const { data, error } = await supabase
      .from('branches')
      .select('system_license')
      .eq('id', license.branchId)
      .single()

    if (error) {
      console.error('License check error:', error)
      return {
        valid: false,
        message: 'فشل التحقق من الترخيص. يرجى المحاولة مرة أخرى.'
      }
    }

    // تحديث آخر فحص
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
  } catch (error) {
    console.error('Validate license error:', error)
    return {
      valid: false,
      message: 'خطأ في التحقق من الترخيص'
    }
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
      message: isValid ? 'الترخيص نشط ✓' : 'الترخيص منتهي',
      lastChecked: license.lastChecked
    }
  } catch (error) {
    console.error('Get cached license error:', error)
    return {
      valid: false,
      message: 'خطأ في قراءة الترخيص'
    }
  }
}
