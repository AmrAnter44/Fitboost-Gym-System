import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { calculateNetSalary } from '../../../../lib/payroll/calculateNetSalary'
import { detectAnomalies } from '../../../../lib/payroll/detectAnomalies'

export const dynamic = 'force-dynamic'

// GET ?year=&month= — detect anomalies across all active staff
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canManagePayroll')
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '0', 10)
    const month = parseInt(searchParams.get('month') || '0', 10)
    if (!year || !month) return NextResponse.json({ error: 'year و month مطلوبين' }, { status: 400 })

    const staff = await prisma.staff.findMany({ where: { isActive: true }, select: { id: true } })
    const breakdowns = await Promise.all(staff.map(s => calculateNetSalary(s.id, year, month)))
    const anomalies = await detectAnomalies(breakdowns, year, month)
    return NextResponse.json(anomalies)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الرواتب مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
