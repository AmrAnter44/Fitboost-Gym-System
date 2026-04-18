import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../lib/auditLog'

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
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { name, duration, price, freePTSessions, freeNutritionSessions, freePhysioSessions, freeGroupClassSessions, freePoolSessions, freePadelSessions, freeAssessmentSessions, nutritionPrice, physioPrice, groupClassPrice, inBodyScans, invitations, freezeDays, ptCommission, icon, upgradeEligibilityDays, upgradePoints } = body

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
        freeNutritionSessions: parseInt(freeNutritionSessions) || 0,
        freePhysioSessions: parseInt(freePhysioSessions) || 0,
        freeGroupClassSessions: parseInt(freeGroupClassSessions) || 0,
        freePoolSessions: parseInt(freePoolSessions) || 0,
        freePadelSessions: parseInt(freePadelSessions) || 0,
        freeAssessmentSessions: parseInt(freeAssessmentSessions) || 0,
        nutritionPrice: parseFloat(nutritionPrice) || 0,
        physioPrice: parseFloat(physioPrice) || 0,
        groupClassPrice: parseFloat(groupClassPrice) || 0,
        inBodyScans: parseInt(inBodyScans) || 0,
        invitations: parseInt(invitations) || 0,
        freezeDays: parseInt(freezeDays) || 0,
        ptCommission: parseFloat(ptCommission) || 0,
        icon: icon || '📅',
        upgradeEligibilityDays: upgradeEligibilityDays ? parseInt(upgradeEligibilityDays) : null,
        upgradePoints: parseInt(upgradePoints) || 0
      }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'CREATE', resource: 'Offer', resourceId: offer.id,
      details: { name: offer.name, duration: offer.duration, price: offer.price },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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
    const user = await requirePermission(request, 'canAccessSettings')

    const body = await request.json()
    const { id, name, duration, price, freePTSessions, freeNutritionSessions, freePhysioSessions, freeGroupClassSessions, freePoolSessions, freePadelSessions, freeAssessmentSessions, nutritionPrice, physioPrice, groupClassPrice, inBodyScans, invitations, freezeDays, ptCommission, icon, isActive, upgradeEligibilityDays, upgradePoints } = body

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
        freeNutritionSessions: parseInt(freeNutritionSessions) || 0,
        freePhysioSessions: parseInt(freePhysioSessions) || 0,
        freeGroupClassSessions: parseInt(freeGroupClassSessions) || 0,
        freePoolSessions: parseInt(freePoolSessions) || 0,
        freePadelSessions: parseInt(freePadelSessions) || 0,
        freeAssessmentSessions: parseInt(freeAssessmentSessions) || 0,
        nutritionPrice: parseFloat(nutritionPrice) || 0,
        physioPrice: parseFloat(physioPrice) || 0,
        groupClassPrice: parseFloat(groupClassPrice) || 0,
        inBodyScans: parseInt(inBodyScans) || 0,
        invitations: parseInt(invitations) || 0,
        freezeDays: parseInt(freezeDays) || 0,
        ptCommission: parseFloat(ptCommission) || 0,
        icon: icon || '📅',
        isActive: isActive !== undefined ? isActive : true,
        upgradeEligibilityDays: upgradeEligibilityDays ? parseInt(upgradeEligibilityDays) : null,
        upgradePoints: upgradePoints !== undefined ? parseInt(upgradePoints) || 0 : 0
      }
    })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'Offer', resourceId: offer.id,
      details: { name: offer.name, duration: offer.duration, price: offer.price, isActive: offer.isActive },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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
    const user = await requirePermission(request, 'canAccessSettings')

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'معرف العرض مطلوب' },
        { status: 400 }
      )
    }

    const offerToDelete = await prisma.offer.findUnique({ where: { id }, select: { name: true, duration: true } })
    await prisma.offer.delete({ where: { id } })

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'DELETE', resource: 'Offer', resourceId: id,
      details: { name: offerToDelete?.name, duration: offerToDelete?.duration },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
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
