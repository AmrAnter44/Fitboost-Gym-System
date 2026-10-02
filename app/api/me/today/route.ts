// «يومي» — بيانات الموظف المسجّل دخول بس (شيفت النهارده، حضوره، ساعات الشهر، مهامه)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { getOpenRecord, getSmartSettings } from '../../../../lib/smartAttendance'

export const dynamic = 'force-dynamic'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)
  const smart = await getSmartSettings()
  const tasks = await prisma.taskAssignment.findMany({
    where: { userId: user.userId, status: 'pending' },
    include: { task: { select: { title: true, dueDate: true, priority: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  const base = {
    name: user.name,
    role: user.role,
    isManager,
    smart: {
      enabled: smart.enabled,
      hasLocation: smart.lat != null && smart.lng != null,
      radiusM: smart.radiusM,
      requireSelfie: smart.requireSelfie,
    },
    tasks: tasks.map(t => ({ id: t.id, title: t.task.title, dueDate: t.task.dueDate, priority: t.task.priority })),
  }
  if (!user.staffId) return NextResponse.json({ ...base, staff: null })

  const staff = await prisma.staff.findUnique({
    where: { id: user.staffId },
    select: { id: true, name: true, staffCode: true, shiftStartTime: true, shiftEndTime: true, workingHours: true, isActive: true },
  })
  if (!staff) return NextResponse.json({ ...base, staff: null })

  const now = new Date()
  const today = DAYS[now.getDay()]
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart.getTime() + 86_400_000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [rotations, shiftToday, open, todayRecs, monthRecs, pendingLeaves] = await Promise.all([
    prisma.rotation.findMany({ where: { staffId: staff.id, isActive: true } }),
    prisma.shiftAssignment.findFirst({ where: { staffId: staff.id, date: { gte: dayStart, lt: dayEnd } } }),
    getOpenRecord(staff.id, staff.workingHours),
    prisma.attendance.findMany({ where: { staffId: staff.id, checkIn: { gte: dayStart, lt: dayEnd } }, orderBy: { checkIn: 'asc' } }),
    prisma.attendance.findMany({ where: { staffId: staff.id, checkIn: { gte: monthStart } }, select: { checkIn: true, duration: true, checkOut: true } }),
    prisma.leave.count({ where: { staffId: staff.id, status: 'pending' } }),
  ])

  // الشيفت: جدول الشيفتات (لو موجود) ← الـ Rotation بتاع اليوم ← الافتراضي بتاع الموظف
  const rot = rotations.find(r => r.dayOfWeek === today)
  let shift: { start: string | null; end: string | null; off: boolean } = {
    start: staff.shiftStartTime || null, end: staff.shiftEndTime || null, off: false,
  }
  if (shiftToday) shift = { start: shiftToday.startTime, end: shiftToday.endTime, off: false }
  else if (rot) shift = { start: rot.startTime, end: rot.endTime, off: false }
  else if (rotations.length > 0) shift = { start: null, end: null, off: true }

  let minutes = 0
  const days = new Set<string>()
  for (const r of monthRecs) {
    days.add(r.checkIn.toDateString())
    minutes += r.duration ?? (r.checkOut ? 0 : Math.round((now.getTime() - r.checkIn.getTime()) / 60_000))
  }

  return NextResponse.json({
    ...base,
    staff: { name: staff.name, staffCode: staff.staffCode },
    shift,
    open: open ? { checkIn: open.checkIn } : null,
    today: todayRecs.map(r => ({ checkIn: r.checkIn, checkOut: r.checkOut, duration: r.duration, selfie: !!r.selfieImage })),
    month: { minutes, days: days.size },
    pendingLeaves,
  })
}
