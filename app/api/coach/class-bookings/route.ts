// 🧘 حجوزات كلاسات الكوتش — كل كلاس بيقدّمه (من النهارده لـ 7 أيام) + عدد الحاجزين وأسماءهم
//  الكلاس بتاع الكوتش = instructorStaffId = موظفه، أو coachName = اسمه
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

const DAYS_AHEAD = 7

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  try {
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { staffId: true } })
    const staff = u?.staffId ? await prisma.staff.findUnique({ where: { id: u.staffId }, select: { id: true, name: true } }) : null
    if (!staff) return NextResponse.json({ classes: [] })

    const schedules = await prisma.classSchedule.findMany({
      where: { isActive: true, OR: [{ instructorStaffId: staff.id }, { coachName: staff.name }] },
      select: { id: true, className: true, startTime: true, dayOfWeek: true, duration: true, gender: true },
    })
    if (!schedules.length) return NextResponse.json({ classes: [] })

    const from = new Date(); from.setHours(0, 0, 0, 0)
    const to = new Date(from); to.setDate(to.getDate() + DAYS_AHEAD); to.setHours(23, 59, 59, 999)

    const bookings = await prisma.classBooking.findMany({
      where: { classScheduleId: { in: schedules.map(s => s.id) }, bookingDate: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      select: { memberId: true, classScheduleId: true, bookingDate: true },
    })
    const members = await prisma.member.findMany({
      where: { id: { in: [...new Set(bookings.map(b => b.memberId))] } },
      select: { id: true, name: true, memberNumber: true, profileImage: true },
    })
    const mMap = new Map(members.map(m => [m.id, m]))

    //  كل ميعاد كلاس في الأيام الجاية (حتى لو مفيش حجوزات) — مترتب بالتاريخ والساعة
    const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const out: any[] = []
    for (let i = 0; i <= DAYS_AHEAD; i++) {
      const d = new Date(from); d.setDate(d.getDate() + i)
      for (const s of schedules.filter(x => x.dayOfWeek === d.getDay())) {
        const list = bookings
          .filter(b => b.classScheduleId === s.id && ymd(new Date(b.bookingDate)) === ymd(d))
          .map(b => mMap.get(b.memberId))
          .filter(Boolean)
          .map((m: any) => ({ id: m.id, name: m.name, memberNumber: m.memberNumber, hasPhoto: !!m.profileImage }))
        out.push({ scheduleId: s.id, date: ymd(d), className: s.className, startTime: s.startTime, duration: s.duration, gender: s.gender, count: list.length, members: list })
      }
    }
    out.sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    //  الكلاسات اللي خلصت النهارده (بعد الميعاد + المدة) مالهاش لازمة
    const now = new Date()
    const upcoming = out.filter(c => {
      const [h, m] = String(c.startTime || '00:00').split(':').map(Number)
      const end = new Date(`${c.date}T00:00:00`); end.setHours(h || 0, (m || 0) + (c.duration || 60))
      return end >= now
    })
    return NextResponse.json({ classes: upcoming })
  } catch (e) {
    console.error('coach class-bookings error:', e)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
