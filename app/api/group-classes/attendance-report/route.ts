import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const parseDateLocal = (s: string | null): Date | null => {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  const dt = new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]))
  return isNaN(dt.getTime()) ? null : dt
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

//  تقرير حضور الكلاسات — مين حجز وهل دخل الجيم (تشيك إن) في نفس اليوم
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canViewGroupClass')

    const { searchParams } = new URL(request.url)
    const fromP = parseDateLocal(searchParams.get('from') || searchParams.get('dateFrom'))
    const toP = parseDateLocal(searchParams.get('to') || searchParams.get('dateTo'))
    const scheduleId = searchParams.get('scheduleId') || searchParams.get('classScheduleId')
    const now = new Date()
    const from = fromP
      ? new Date(fromP.getFullYear(), fromP.getMonth(), fromP.getDate(), 0, 0, 0, 0)
      : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    const to = toP
      ? new Date(toP.getFullYear(), toP.getMonth(), toP.getDate(), 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    const bookingWhere: any = { bookingDate: { gte: from, lte: to } }
    if (scheduleId) bookingWhere.classScheduleId = scheduleId

    const bookings = await prisma.classBooking.findMany({
      where: bookingWhere,
      orderBy: [{ bookingDate: 'asc' }, { createdAt: 'asc' }],
    })

    const checkIns = await prisma.memberCheckIn.findMany({
      where: { checkInTime: { gte: from, lte: to } },
      select: { memberId: true, checkInTime: true },
    })
    const checkInMap = new Map<string, Date>()
    for (const c of checkIns) {
      const key = `${c.memberId}|${ymd(c.checkInTime)}`
      const prev = checkInMap.get(key)
      if (!prev || c.checkInTime < prev) checkInMap.set(key, c.checkInTime)
    }

    const memberIds = [...new Set(bookings.map((b) => b.memberId))]
    const scheduleIds = [...new Set(bookings.map((b) => b.classScheduleId))]
    const [members, schedules] = await Promise.all([
      prisma.member.findMany({ where: { id: { in: memberIds } }, select: { id: true, name: true, memberNumber: true, phone: true } }),
      prisma.classSchedule.findMany({ where: { id: { in: scheduleIds } }, select: { id: true, className: true, coachName: true, startTime: true, dayOfWeek: true } }),
    ])
    const mMap = new Map(members.map((m) => [m.id, m]))
    const sMap = new Map(schedules.map((s) => [s.id, s]))

    const rows = bookings.map((b) => {
      const ci = checkInMap.get(`${b.memberId}|${ymd(b.bookingDate)}`) || null
      const mem = mMap.get(b.memberId)
      const sc = sMap.get(b.classScheduleId)
      return {
        id: b.id,
        bookingDate: b.bookingDate,
        memberName: mem?.name || null,
        memberNumber: mem?.memberNumber || null,
        memberPhone: mem?.phone || null,
        className: sc?.className || null,
        coachName: sc?.coachName || null,
        startTime: sc?.startTime || null,
        dayOfWeek: sc?.dayOfWeek ?? null,
        attended: !!ci,
        checkInTime: ci,
      }
    })

    const attended = rows.filter((r) => r.attended).length
    const summary = {
      totalBookings: rows.length,
      attended,
      absent: rows.length - attended,
      attendanceRate: rows.length ? Math.round((attended / rows.length) * 100) : 0,
    }

    const classAgg = new Map<string, { className: string; coachName: string; booked: number; attended: number }>()
    for (const b of bookings) {
      const sc = sMap.get(b.classScheduleId)
      const cur = classAgg.get(b.classScheduleId) || { className: sc?.className || '—', coachName: sc?.coachName || '—', booked: 0, attended: 0 }
      cur.booked++
      if (checkInMap.has(`${b.memberId}|${ymd(b.bookingDate)}`)) cur.attended++
      classAgg.set(b.classScheduleId, cur)
    }
    const byClass = [...classAgg.values()].sort((a, b) => b.booked - a.booked)

    return NextResponse.json({ rows, summary, byClass })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    console.error('Class attendance report error:', error)
    return NextResponse.json({ error: 'فشل تحميل تقرير الحضور' }, { status: 500 })
  }
}
