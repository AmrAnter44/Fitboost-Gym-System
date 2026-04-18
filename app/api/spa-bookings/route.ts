// app/api/spa-bookings/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { logError } from '../../../lib/errorLogger'

// GET - جلب جميع الحجوزات مع Filters

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من صلاحية عرض حجوزات SPA
    await requirePermission(request, 'canViewSpaBookings')

    // جلب query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const serviceType = searchParams.get('serviceType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')


    // بناء الـ where clause
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (serviceType) {
      where.serviceType = serviceType
    }

    if (startDate && endDate) {
      where.bookingDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (search) {
      where.OR = [
        { memberName: { contains: search } },
        { memberPhone: { contains: search } }
      ]
    }

    // جلب البيانات
    const bookings = await prisma.spaBooking.findMany({
      where,
      include: {
        member: {
          select: {
            id: true,
            name: true,
            phone: true,
            memberNumber: true
          }
        }
      },
      orderBy: [
        { bookingDate: 'desc' },
        { bookingTime: 'asc' }
      ]
    })


    return NextResponse.json(bookings, { status: 200 })
  } catch (error: any) {
    console.error('❌ خطأ في جلب حجوزات SPA:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/spa-bookings',
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
      { error: 'فشل جلب حجوزات SPA' },
      { status: 500 }
    )
  }
}

// POST - إنشاء حجز جديد
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية إنشاء حجز SPA
    const currentUser = await requirePermission(request, 'canCreateSpaBooking')

    const body = await request.json()
    const {
      memberId,
      serviceType,
      bookingDate,
      bookingTime,
      duration,
      notes
    } = body


    // التحقق من الحقول المطلوبة
    if (!memberId || !serviceType || !bookingDate || !bookingTime || !duration) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
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

    // التحقق من صحة المدة
    if (![30, 60, 90].includes(parseInt(duration))) {
      return NextResponse.json(
        { error: 'المدة يجب أن تكون 30 أو 60 أو 90 دقيقة' },
        { status: 400 }
      )
    }

    // التحقق من وجود العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        phone: true
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من عدم وجود تعارض (حجز واحد فقط في نفس الوقت - بغض النظر عن نوع الخدمة)
    const MAX_CAPACITY = 1
    const existingBookingsCount = await prisma.spaBooking.count({
      where: {
        bookingDate: new Date(bookingDate),
        bookingTime: bookingTime,
        // لا نفلتر حسب serviceType - أي حجز في هذا الوقت يمنع حجوزات أخرى
        status: { in: ['pending', 'confirmed'] }
      }
    })

    if (existingBookingsCount >= MAX_CAPACITY) {
      return NextResponse.json(
        { error: 'الوقت المحدد ممتلئ. الرجاء اختيار وقت آخر' },
        { status: 400 }
      )
    }

    // التحقق من وجود المستخدم الحالي في قاعدة البيانات
    let validUserId: string | null = null
    if (currentUser.userId) {
      const userExists = await prisma.user.findUnique({
        where: { id: currentUser.userId }
      })
      if (userExists) {
        validUserId = currentUser.userId
      }
    }

    // إنشاء الحجز
    const booking = await prisma.spaBooking.create({
      data: {
        memberId,
        memberName: member.name,
        memberPhone: member.phone,
        serviceType,
        bookingDate: new Date(bookingDate),
        bookingTime,
        duration: parseInt(duration),
        notes: notes || null,
        status: 'pending',
        createdBy: currentUser.name,
        createdByUserId: validUserId
      },
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


    return NextResponse.json(booking, { status: 201 })
  } catch (error: any) {
    console.error('❌ خطأ في إنشاء حجز SPA:', error)

    const statusCode = error.message === 'Unauthorized' ? 401
      : error.message.includes('Forbidden') ? 403
      : 500

    logError({
      error,
      endpoint: '/api/spa-bookings',
      method: 'POST',
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
        { error: 'ليس لديك صلاحية إنشاء حجوزات SPA' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'فشل إنشاء حجز SPA' },
      { status: 500 }
    )
  }
}
