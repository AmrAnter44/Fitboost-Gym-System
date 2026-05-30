import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requireAdmin } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET ?year=&month= → all shift assignments for the given month (all staff)
// Or ?staffId=&from=&to= for a specific staff's range
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (staffId) where.staffId = staffId
    if (year && month) {
      where.date = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      }
    } else if (from && to) {
      where.date = { gte: new Date(from), lte: new Date(to) }
    }

    const shifts = await prisma.shiftAssignment.findMany({
      where,
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
      include: { staff: { select: { id: true, name: true, staffCode: true } } },
    })
    return NextResponse.json(shifts)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

// POST { staffId, date, startTime, endTime, notes? }
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { staffId, date, startTime, endTime, notes } = body
    if (!staffId || !date || !startTime || !endTime) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    const shift = await prisma.shiftAssignment.create({
      data: {
        staffId,
        date: new Date(date),
        startTime,
        endTime,
        notes: notes || null,
      },
    })
    return NextResponse.json(shift, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
