import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { fromStartDate, fromEndDate, toStartDate, staffIds? }
// Copy all shifts from one date range to a new starting date (preserves relative day offsets)
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canManagePayroll')
    const body = await request.json()
    const { fromStartDate, fromEndDate, toStartDate, staffIds } = body
    if (!fromStartDate || !fromEndDate || !toStartDate) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    const fromStart = new Date(fromStartDate)
    const fromEnd = new Date(fromEndDate)
    const toStart = new Date(toStartDate)
    const offsetMs = toStart.getTime() - fromStart.getTime()

    const where: any = {
      date: { gte: fromStart, lte: fromEnd },
    }
    if (Array.isArray(staffIds) && staffIds.length > 0) where.staffId = { in: staffIds }

    const source = await prisma.shiftAssignment.findMany({ where })
    if (source.length === 0) {
      return NextResponse.json({ count: 0 })
    }

    await prisma.shiftAssignment.createMany({
      data: source.map(s => ({
        staffId: s.staffId,
        date: new Date(s.date.getTime() + offsetMs),
        startTime: s.startTime,
        endTime: s.endTime,
        notes: s.notes,
      })),
    })
    return NextResponse.json({ count: source.length }, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الرواتب مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
