import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission, verifyAuth } from '../../../../lib/auth'
import { apiCache } from '../../../../lib/cache'

export const dynamic = 'force-dynamic'

// GET - جلب إعدادات الخدمات
// ✅ السماح لجميع المستخدمين المسجلين بقراءة الإعدادات (بدون صلاحية)
// هذا ضروري لإخفاء الأقسام المعطلة من Navigation للمستخدمين العاديين
export async function GET(request: Request) {
  try {
    // التحقق من تسجيل الدخول فقط (بدون صلاحية محددة)
    const user = await verifyAuth(request)
    if (!user) {
      throw new Error('Unauthorized')
    }

    let settings = await prisma.systemSettings.findUnique({
      where: { id: 'singleton' }
    })

    // إنشاء إعدادات افتراضية إذا لم تكن موجودة
    if (!settings) {
      settings = await prisma.systemSettings.create({
        data: {
          id: 'singleton',
          nutritionEnabled: true,
          physiotherapyEnabled: true,
          groupClassEnabled: true,
          spaEnabled: true,
          inBodyEnabled: true,
          pointsEnabled: true,
          pointsPerCheckIn: 1,
          pointsPerInvitation: 2,
          pointsPerReferral: 0,
          pointsValueInEGP: 0.1,
          pointsPerEGPSpent: 0.1,
          websiteUrl: 'https://www.xgym.website',
          showWebsiteOnReceipts: false,
          ptCommissionEnabled: true,
          ptCommissionAmount: 50,
          nutritionReferralEnabled: false,
          nutritionReferralPercentage: 0,
          physioReferralEnabled: false,
          physioReferralPercentage: 0
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error fetching service settings:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية الوصول للإعدادات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل جلب إعدادات الخدمات' }, { status: 500 })
  }
}

// PUT/POST - تحديث إعدادات الخدمات
async function updateSettings(request: Request) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()

    // تحديث جميع الحقول الموجودة في الطلب
    const updateData: any = {}
    const validFields = [
      'nutritionEnabled', 'physiotherapyEnabled', 'groupClassEnabled',
      'spaEnabled', 'inBodyEnabled', 'pointsEnabled',
      'pointsPerCheckIn', 'pointsPerInvitation', 'pointsPerReferral',
      'pointsValueInEGP', 'pointsPerEGPSpent',
      'websiteUrl', 'showWebsiteOnReceipts',
      'trackFreeSessionsCost', 'freePTSessionPrice',
      'freeNutritionSessionPrice', 'freePhysioSessionPrice',
      'freeGroupClassSessionPrice',
      'ptCommissionEnabled', 'ptCommissionAmount',
      'nutritionReferralEnabled', 'nutritionReferralPercentage',
      'physioReferralEnabled', 'physioReferralPercentage'
    ]

    validFields.forEach(field => {
      if (field in body) {
        updateData[field] = body[field]
      }
    })

    updateData.updatedBy = user.userId

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: updateData,
      create: {
        id: 'singleton',
        ...updateData
      }
    })

    // Invalidate public settings cache so mobile apps pick up the change immediately
    apiCache.delete('public:settings')

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error updating service settings:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تحديث الإعدادات' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث إعدادات الخدمات' }, { status: 500 })
  }
}

export const PUT = updateSettings
export const POST = updateSettings
