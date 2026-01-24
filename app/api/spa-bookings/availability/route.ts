// app/api/spa-bookings/availability/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { logError } from '../../../../lib/errorLogger'

// GET - جلب الأوقات المتاحة لتاريخ ونوع خدمة معينة

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من صلاحية عرض حجوزات SPA
    await requirePermission(request, 'canViewSpaBookings')

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') // "2024-01-15"
    const serviceType = searchParams.get('serviceType') // "massage"

    if (!date || !serviceType) {
      return NextResponse.json(
        { error: 'التاريخ ونوع الخدمة مطلوبان' },
        { status: 400 }
      )
    }

    // التحقق من صحة نوع الخدمة
    if (!['massage', 'sauna', 'jacuzzi'].includes(serviceType)) {
      return NextResponse.json(
        { error: 'نوع الخدمة غير صحيح' },
        { status: 400 }
      )
    }

    console.log('🔍 جلب الأوقات المتاحة:', { date, serviceType })

    // توليد الأوقات المتاحة (من 9 صباحاً إلى 8 مساءً كل ساعة)
    const timeSlots = []
    const MAX_CAPACITY = 1 // حجز واحد فقط في نفس الوقت (بغض النظر عن نوع الخدمة)

    for (let hour = 9; hour <= 20; hour++) {
      const time = `${hour.toString().padStart(2, '0')}:00`

      // عد الحجوزات في هذا الوقت (لجميع الخدمات)
      const bookingsCount = await prisma.spaBooking.count({
        where: {
          bookingDate: new Date(date),
          bookingTime: time,
          // لا نفلتر حسب serviceType - أي حجز في هذا الوقت يمنع حجوزات أخرى
          status: { in: ['pending', 'confirmed'] }
        }
      })

      timeSlots.push({
        time,
        available: bookingsCount < MAX_CAPACITY,
        bookings: bookingsCount,
        capacity: MAX_CAPACITY,
        remaining: MAX_CAPACITY - bookingsCount
      })
    }

    console.log('✅ تم توليد', timeSlots.length, 'وقت متاح')

    return NextResponse.json(timeSlots, { status: 200 })
  } catch (error: any) {
    console.error('❌ خطأ في جلب الأوقات المتاحة:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/spa-bookings/availability',
      method: 'GET',
      statusCode
    })

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية عرض حجوزات SPA' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل جلب الأوقات المتاحة' },
      { status: 500 }
    )
  }
}
