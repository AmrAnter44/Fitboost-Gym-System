// app/api/spa-bookings/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { logError } from '../../../../lib/errorLogger'

// GET - جلب حجز واحد

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من صلاحية عرض حجوزات SPA
    await requirePermission(request, 'canViewSpaBookings')

    const { id } = params


    const booking = await prisma.spaBooking.findUnique({
      where: { id },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            memberNumber: true
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    })

    if (!booking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      )
    }


    return NextResponse.json(booking, { status: 200 })
  } catch (error: any) {
    console.error('❌ خطأ في جلب الحجز:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: `/api/spa-bookings/${params.id}`,
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
      { error: 'فشل جلب الحجز' },
      { status: 500 }
    )
  }
}

// PUT - تحديث حجز
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من صلاحية تعديل حجز SPA
    await requirePermission(request, 'canEditSpaBooking')

    const { id } = params
    const body = await request.json()
    const { status, bookingDate, bookingTime, duration, notes, serviceType } = body


    // التحقق من وجود الحجز
    const existingBooking = await prisma.spaBooking.findUnique({
      where: { id }
    })

    if (!existingBooking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      )
    }

    // بناء بيانات التحديث
    const updateData: any = {}

    if (status) {
      if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
        return NextResponse.json(
          { error: 'حالة الحجز غير صحيحة' },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    if (serviceType) {
      if (!['massage', 'sauna', 'jacuzzi'].includes(serviceType)) {
        return NextResponse.json(
          { error: 'نوع الخدمة غير صحيح' },
          { status: 400 }
        )
      }
      updateData.serviceType = serviceType
    }

    if (bookingDate) {
      updateData.bookingDate = new Date(bookingDate)
    }

    if (bookingTime) {
      updateData.bookingTime = bookingTime
    }

    if (duration) {
      if (![30, 60, 90].includes(parseInt(duration))) {
        return NextResponse.json(
          { error: 'المدة يجب أن تكون 30 أو 60 أو 90 دقيقة' },
          { status: 400 }
        )
      }
      updateData.duration = parseInt(duration)
    }

    if (notes !== undefined) {
      updateData.notes = notes || null
    }

    // تحديث الحجز
    const booking = await prisma.spaBooking.update({
      where: { id },
      data: updateData,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            memberNumber: true
          }
        }
      }
    })


    return NextResponse.json(booking, { status: 200 })
  } catch (error: any) {
    console.error('❌ خطأ في تحديث الحجز:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: `/api/spa-bookings/${params.id}`,
      method: 'PUT',
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
        { error: 'ليس لديك صلاحية تعديل حجوزات SPA' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل تحديث الحجز' },
      { status: 500 }
    )
  }
}

// DELETE - إلغاء/حذف حجز
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من صلاحية إلغاء حجز SPA
    await requirePermission(request, 'canCancelSpaBooking')

    const { id } = params


    // التحقق من وجود الحجز
    const existingBooking = await prisma.spaBooking.findUnique({
      where: { id }
    })

    if (!existingBooking) {
      return NextResponse.json(
        { error: 'الحجز غير موجود' },
        { status: 404 }
      )
    }

    // تغيير الحالة إلى cancelled بدلاً من الحذف الفعلي
    await prisma.spaBooking.update({
      where: { id },
      data: { status: 'cancelled' }
    })


    return NextResponse.json(
      { success: true, message: 'تم إلغاء الحجز بنجاح' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('❌ خطأ في إلغاء الحجز:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: `/api/spa-bookings/${params.id}`,
      method: 'DELETE',
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
        { error: 'ليس لديك صلاحية إلغاء حجوزات SPA' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل إلغاء الحجز' },
      { status: 500 }
    )
  }
}
