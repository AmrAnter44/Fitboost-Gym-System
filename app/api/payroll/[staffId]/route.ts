import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { calculateNetSalary } from '../../../../lib/payroll/calculateNetSalary'

export const dynamic = 'force-dynamic'

// GET — breakdown كامل لموظف واحد في شهر معين
export async function GET(request: Request, ctx: { params: Promise<{ staffId: string }> }) {
  try {
    await requireAdmin(request)
    const { staffId } = await ctx.params
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '0', 10)
    const month = parseInt(searchParams.get('month') || '0', 10)

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year و month مطلوبين' }, { status: 400 })
    }

    const breakdown = await calculateNetSalary(staffId, year, month)
    return NextResponse.json(breakdown)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    console.error('Payroll calc error:', e)
    return NextResponse.json({ error: e.message || 'فشل حساب الراتب' }, { status: 500 })
  }
}
