import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - جلب إعدادات الخدمات
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canAccessSettings')

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
          pointsValueInEGP: 0.1,
          pointsPerEGPSpent: 0.1,
          websiteUrl: 'https://www.xgym.website',
          showWebsiteOnReceipts: true
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

// PUT - تحديث إعدادات الخدمات
export async function PUT(request: Request) {
  try {
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { nutritionEnabled, physiotherapyEnabled, groupClassEnabled, spaEnabled, inBodyEnabled, pointsEnabled, pointsPerCheckIn, pointsPerInvitation, pointsValueInEGP, pointsPerEGPSpent, websiteUrl, showWebsiteOnReceipts } = body

    const settings = await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: {
        nutritionEnabled,
        physiotherapyEnabled,
        groupClassEnabled,
        spaEnabled,
        inBodyEnabled,
        pointsEnabled,
        pointsPerCheckIn,
        pointsPerInvitation,
        pointsValueInEGP,
        pointsPerEGPSpent,
        websiteUrl,
        showWebsiteOnReceipts,
        updatedBy: user.userId
      },
      create: {
        id: 'singleton',
        nutritionEnabled,
        physiotherapyEnabled,
        groupClassEnabled,
        spaEnabled,
        inBodyEnabled,
        pointsEnabled,
        pointsPerCheckIn,
        pointsPerInvitation,
        pointsValueInEGP,
        pointsPerEGPSpent,
        websiteUrl,
        showWebsiteOnReceipts,
        updatedBy: user.userId
      }
    })

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
