// app/api/spa-bookings/hours/route.ts — مواعيد تشغيل الاسبا (ليميت)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth, requireAnyPermission } from '../../../../lib/auth'
import { getSpaHours, normalizeTime, timeToMinutes, DEFAULT_SPA_OPEN, DEFAULT_SPA_CLOSE } from '../../../../lib/spaHours'
import { createAuditLog, getIpAddress, getUserAgent } from '../../../../lib/auditLog'

export const dynamic = 'force-dynamic'

// GET — قراءة مواعيد تشغيل الاسبا (أي مستخدم مسجّل)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    const hours = await getSpaHours(prisma)
    return NextResponse.json(hours)
  } catch (error) {
    console.error('❌ خطأ في جلب مواعيد الاسبا:', error)
    return NextResponse.json({ error: 'فشل جلب مواعيد الاسبا' }, { status: 500 })
  }
}

// PUT — تعديل مواعيد تشغيل الاسبا (صلاحية إعدادات أو تعديل حجوزات الاسبا)
export async function PUT(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canAccessSettings', 'canEditSpaBooking'])

    const body = await request.json()
    const openTime = normalizeTime(body.openTime, DEFAULT_SPA_OPEN)
    const closeTime = normalizeTime(body.closeTime, DEFAULT_SPA_CLOSE)

    // لازم القفل يكون بعد الفتح
    if ((timeToMinutes(closeTime) as number) <= (timeToMinutes(openTime) as number)) {
      return NextResponse.json(
        { error: 'ميعاد القفل لازم يكون بعد ميعاد الفتح' },
        { status: 400 }
      )
    }

    // نضمن وجود صف الإعدادات (من غير ما نلمس الأعمدة الجديدة — الـ client ممكن يكون قديم)
    await prisma.systemSettings.upsert({
      where: { id: 'singleton' },
      update: {},
      create: { id: 'singleton' },
    })

    // الكتابة بـ raw SQL (الأعمدة جديدة — تفادي الـ client القديم)
    await prisma.$executeRawUnsafe(
      `UPDATE SystemSettings SET spaOpenTime = ?, spaCloseTime = ? WHERE id = 'singleton'`,
      openTime,
      closeTime
    )

    createAuditLog({
      userId: user.userId, userEmail: user.email, userName: user.name, userRole: user.role,
      action: 'UPDATE', resource: 'System', resourceId: 'singleton',
      details: { operation: 'UpdateSpaHours', openTime, closeTime },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success'
    })

    return NextResponse.json({ success: true, openTime, closeTime })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل مواعيد الاسبا' }, { status: 403 })
    }
    console.error('❌ خطأ في تعديل مواعيد الاسبا:', error)
    return NextResponse.json({ error: 'فشل تعديل مواعيد الاسبا' }, { status: 500 })
  }
}
