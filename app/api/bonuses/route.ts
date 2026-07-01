import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requireAdmin } from '../../../lib/auth'
import { getStaffDailyRate } from '../../../lib/payroll/dailyRate'

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

// POST { staffId, amount?, days?, reason, month, year, notes? }
// days > 0 → "بونص يوم": amount = days × (المرتب ÷ أيام العمل) — بيتحسب من مرتب الموظف
export async function POST(request: Request) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    const { staffId, amount, reason, month, year, notes, days } = body
    if (!staffId || !reason || !month || !year) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    if (month < 1 || month > 12) {
      return NextResponse.json({ error: 'الشهر غير صحيح' }, { status: 400 })
    }

    // حساب المبلغ من عدد الأيام (بونص يوم) أو استخدام المبلغ المباشر
    let finalAmount: number
    let finalNotes: string | null = notes || null
    const numDays = Number(days)
    if (numDays && numDays > 0) {
      const { dailyRate, monthlySalary } = await getStaffDailyRate(staffId)
      if (monthlySalary <= 0) {
        return NextResponse.json({ error: 'الموظف ملوش مرتب محدد، حدّد المرتب الأول' }, { status: 400 })
      }
      finalAmount = Math.round(numDays * dailyRate)
      const dayLabel = `بونص ${numDays} يوم`
      finalNotes = notes ? `${dayLabel} — ${notes}` : dayLabel
    } else {
      finalAmount = Number(amount)
    }
    if (!finalAmount || finalAmount <= 0) {
      return NextResponse.json({ error: 'المبلغ غير صحيح' }, { status: 400 })
    }

    const bonus = await prisma.bonus.create({
      data: { staffId, amount: finalAmount, reason, month, year, notes: finalNotes },
    })
    return NextResponse.json(bonus, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
