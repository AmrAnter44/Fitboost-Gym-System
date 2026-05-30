import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth, requirePermission } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET — any authenticated user can view holidays
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } })
    return NextResponse.json(holidays)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

// POST { date, name, isPaid?, recurring? }
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canManageHolidays')
    const body = await request.json()
    const { date, name, isPaid, recurring } = body
    if (!date || !name) return NextResponse.json({ error: 'date و name مطلوبين' }, { status: 400 })
    const h = await prisma.holiday.create({
      data: {
        date: new Date(date),
        name,
        isPaid: isPaid ?? true,
        recurring: recurring ?? false,
      },
    })
    return NextResponse.json(h, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الأجازات مطلوبة' }, { status: 403 })
    if (e.code === 'P2002') return NextResponse.json({ error: 'يوجد إجازة في نفس التاريخ' }, { status: 400 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
