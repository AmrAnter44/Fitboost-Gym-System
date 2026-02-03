import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب إعدادات الكومشن
export async function GET(request: NextRequest) {
  try {
    // البحث عن الإعدادات الموجودة
    let settings = await prisma.commissionSettings.findFirst()

    // إذا لم توجد إعدادات، إنشاء إعدادات افتراضية
    if (!settings) {
      settings = await prisma.commissionSettings.create({
        data: {
          tier1Limit: 5000,
          tier2Limit: 11000,
          tier3Limit: 15000,
          tier4Limit: 20000,
          tier1Rate: 25,
          tier2Rate: 30,
          tier3Rate: 35,
          tier4Rate: 40,
          tier5Rate: 45
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching commission settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch commission settings' },
      { status: 500 }
    )
  }
}

// PUT - تحديث إعدادات الكومشن
export async function PUT(request: NextRequest) {
  try {
    // التحقق من صلاحية التعديل
    await requirePermission(request, 'canEditMembers')

    const body = await request.json()
    const {
      tier1Limit,
      tier2Limit,
      tier3Limit,
      tier4Limit,
      tier1Rate,
      tier2Rate,
      tier3Rate,
      tier4Rate,
      tier5Rate
    } = body

    // التحقق من صحة البيانات
    const limits = [tier1Limit, tier2Limit, tier3Limit, tier4Limit]
    const rates = [tier1Rate, tier2Rate, tier3Rate, tier4Rate, tier5Rate]

    // التحقق من أن الحدود مرتبة تصاعدياً
    for (let i = 1; i < limits.length; i++) {
      if (limits[i] <= limits[i - 1]) {
        return NextResponse.json(
          { error: 'يجب أن تكون حدود الدخل مرتبة تصاعدياً' },
          { status: 400 }
        )
      }
    }

    // التحقق من أن النسب موجبة
    for (const rate of rates) {
      if (rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: 'يجب أن تكون النسب بين 0 و 100' },
          { status: 400 }
        )
      }
    }

    // البحث عن الإعدادات الموجودة
    let settings = await prisma.commissionSettings.findFirst()

    if (settings) {
      // تحديث الإعدادات الموجودة
      settings = await prisma.commissionSettings.update({
        where: { id: settings.id },
        data: {
          tier1Limit,
          tier2Limit,
          tier3Limit,
          tier4Limit,
          tier1Rate,
          tier2Rate,
          tier3Rate,
          tier4Rate,
          tier5Rate
        }
      })
    } else {
      // إنشاء إعدادات جديدة
      settings = await prisma.commissionSettings.create({
        data: {
          tier1Limit,
          tier2Limit,
          tier3Limit,
          tier4Limit,
          tier1Rate,
          tier2Rate,
          tier3Rate,
          tier4Rate,
          tier5Rate
        }
      })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error updating commission settings:', error)

    if (error.message === 'Permission denied') {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية لتعديل الإعدادات' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update commission settings' },
      { status: 500 }
    )
  }
}
