import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth, requirePermission } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const parseDateLocal = (s: string | null): Date | null => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return isNaN(dt.getTime()) ? null : dt
}

//  GET — قائمة الحجوزات (فلترة بالتاريخ/الكلاس/العضو) مع بيانات العضو والكلاس
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const from = parseDateLocal(searchParams.get('from'))
    const to = parseDateLocal(searchParams.get('to'))
    const classScheduleId = searchParams.get('scheduleId') || searchParams.get('classScheduleId')
    const memberId = searchParams.get('memberId')

    const where: any = {}
    if (from || to) {
      where.bookingDate = {}
      if (from) where.bookingDate.gte = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0)
      if (to) where.bookingDate.lte = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999)
    }
    if (classScheduleId) where.classScheduleId = classScheduleId
    if (memberId) where.memberId = memberId

    const bookings = await prisma.classBooking.findMany({
      where,
      orderBy: [{ bookingDate: 'asc' }, { createdAt: 'asc' }],
      take: 500,
    })

    //  batch enrich بالعضو والكلاس
    const memberIds = [...new Set(bookings.map((b) => b.memberId))]
    const scheduleIds = [...new Set(bookings.map((b) => b.classScheduleId))]
    const [members, schedules] = await Promise.all([
      prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true, memberNumber: true, phone: true } }),
      prisma.classSchedule.findMany({ where: { id: { in: scheduleIds } }, select: { id: true, className: true, coachName: true, startTime: true, dayOfWeek: true } }),
    ])
    const mMap = new Map(members.map((m) => [m.id, m]))
    const sMap = new Map(schedules.map((s) => [s.id, s]))

    const result = bookings.map((b) => ({
      id: b.id,
      memberId: b.memberId,
      classScheduleId: b.classScheduleId,
      bookingDate: b.bookingDate,
      createdAt: b.createdAt,
      member: mMap.get(b.memberId) || null,
      class: sMap.get(b.classScheduleId) || null,
    }))

    return NextResponse.json({ bookings: result })
  } catch (error) {
    console.error('Get class bookings error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}

//  POST — الموظف يحجز عضو في كلاس من الجدول (أي تاريخ)
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canRegisterClassAttendance')

    const body = await request.json()
    const memberId = (body.memberId || '').trim()
    const classScheduleId = (body.classScheduleId || body.scheduleId || '').trim()
    const parsed = parseDateLocal(body.bookingDate)

    if (!memberId || !classScheduleId || !parsed) {
      return NextResponse.json({ error: 'اختار العضو والكلاس والتاريخ' }, { status: 400 })
    }

    const schedule = await prisma.classSchedule.findUnique({ where: { id: classScheduleId } })
    if (!schedule) return NextResponse.json({ error: 'الكلاس مش موجود' }, { status: 404 })

    const member = await prisma.member.findUnique({ where: { id: memberId }, select: { id: true } })
    if (!member) return NextResponse.json({ error: 'العضو مش موجود' }, { status: 404 })

    const bookingDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0)

    //  منع التكرار (نفس العضو + نفس الكلاس + نفس اليوم) — متوافق مع الـ unique constraint
    const dup = await prisma.classBooking.findFirst({ where: { memberId, classScheduleId, bookingDate } })
    if (dup) return NextResponse.json({ error: 'العضو محجوز بالفعل في الكلاس ده في نفس اليوم' }, { status: 409 })

    const booking = await prisma.classBooking.create({
      data: { memberId, classScheduleId, bookingDate },
    })

    return NextResponse.json({ booking }, { status: 201 })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية حجز الكلاسات' }, { status: 403 })
    console.error('Create class booking error:', error)
    return NextResponse.json({ error: 'فشل الحجز' }, { status: 500 })
  }
}
