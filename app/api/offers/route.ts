import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'

// GET - جلب كل العروض

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const offers = await prisma.offer.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: { duration: 'asc' }
    })

    return NextResponse.json(offers)
  } catch (error) {
    console.error('Error fetching offers:', error)
    // إرجاع array فارغ في حالة الخطأ بدلاً من object
    return NextResponse.json([], { status: 500 })
  }
}

// POST - إنشاء عرض جديد
export async function POST(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { name, duration, price, freePTSessions, inBodyScans, invitations, freezeDays, icon, upgradeEligibilityDays } = body

    // التحقق من البيانات المطلوبة
    if (!name || !duration || price === undefined) {
      return NextResponse.json(
        { error: 'الاسم والمدة والسعر مطلوبة' },
        { status: 400 }
      )
    }

    const offer = await prisma.offer.create({
      data: {
        name,
        duration: parseInt(duration),
        price: parseFloat(price),
        freePTSessions: parseInt(freePTSessions) || 0,
        inBodyScans: parseInt(inBodyScans) || 0,
        invitations: parseInt(invitations) || 0,
        freezeDays: parseInt(freezeDays) || 0,
        icon: icon || '📅',
        upgradeEligibilityDays: upgradeEligibilityDays ? parseInt(upgradeEligibilityDays) : null
      }
    })

    return NextResponse.json(offer, { status: 201 })
  } catch (error: any) {
    console.error('Error creating offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل إنشاء العرض' }, { status: 500 })
  }
}

// PUT - تحديث عرض
export async function PUT(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { id, name, duration, price, freePTSessions, inBodyScans, invitations, freezeDays, icon, isActive, upgradeEligibilityDays } = body

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العرض مطلوب' },
        { status: 400 }
      )
    }

    const offer = await prisma.offer.update({
      where: { id },
      data: {
        name,
        duration: parseInt(duration),
        price: parseFloat(price),
        freePTSessions: parseInt(freePTSessions) || 0,
        inBodyScans: parseInt(inBodyScans) || 0,
        invitations: parseInt(invitations) || 0,
        freezeDays: parseInt(freezeDays) || 0,
        icon: icon || '📅',
        isActive: isActive !== undefined ? isActive : true,
        upgradeEligibilityDays: upgradeEligibilityDays ? parseInt(upgradeEligibilityDays) : null
      }
    })

    return NextResponse.json(offer)
  } catch (error: any) {
    console.error('Error updating offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل تحديث العرض' }, { status: 500 })
  }
}

// DELETE - حذف عرض
export async function DELETE(request: Request) {
  try {
    // ✅ التحقق من صلاحية الإعدادات (الأدمن فقط)
    await requirePermission(request, 'canAccessSettings')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العرض مطلوب' },
        { status: 400 }
      )
    }

    await prisma.offer.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'تم حذف العرض بنجاح' })
  } catch (error: any) {
    console.error('Error deleting offer:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية إدارة العروض' },
        { status: 403 }
      )
    }

    return NextResponse.json({ error: 'فشل حذف العرض' }, { status: 500 })
  }
}
