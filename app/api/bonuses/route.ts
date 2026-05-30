import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requireAdmin } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET ?staffId=&year=&month=
export async function GET(request: Request) {
  try {
    await requireAdmin(request)
    const { searchParams } = new URL(request.url)
    const where: any = {}
    const staffId = searchParams.get('staffId')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined
    if (staffId) where.staffId = staffId
    if (year) where.year = year
    if (month) where.month = month

    const bonuses = await prisma.bonus.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      include: { staff: { select: { id: true, name: true, staffCode: true } } },
    })
    return NextResponse.json(bonuses)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

// POST { staffId, amount, reason, month, year, notes? }
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { staffId, amount, reason, month, year, notes } = body
    if (!staffId || !amount || !reason || !month || !year) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'الشهر غير صحيح' }, { status: 400 })
    }
    const bonus = await prisma.bonus.create({
      data: { staffId, amount, reason, month, year, notes: notes || null },
    })
    return NextResponse.json(bonus, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
