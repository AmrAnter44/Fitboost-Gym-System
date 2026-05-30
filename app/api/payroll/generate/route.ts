import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../../lib/auth'
import { generatePayslip } from '../../../../lib/payroll/generatePayslip'

export const dynamic = 'force-dynamic'

// POST { year, month, staffIds: string[] } — generate payslips for the given staff
export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request)
    const body = await request.json()
    const { year, month, staffIds } = body as { year?: number; month?: number; staffIds?: string[] }

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json({ error: 'year و month مطلوبين' }, { status: 400 })
    }
    if (!staffIds || !Array.isArray(staffIds) || staffIds.length === 0) {
      return NextResponse.json({ error: 'staffIds مطلوبين' }, { status: 400 })
    }

    const results: { staffId: string; ok: boolean; payslipId?: string; error?: string }[] = []
    for (const staffId of staffIds) {
      try {
        const { payslip } = await generatePayslip(staffId, year, month, user.userId)
        results.push({ staffId, ok: true, payslipId: payslip.id })
      } catch (e: any) {
        results.push({ staffId, ok: false, error: e.message || 'فشل' })
      }
    }

    const successCount = results.filter(r => r.ok).length
    return NextResponse.json({ results, successCount, failedCount: results.length - successCount })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    console.error('Payslip generate error:', e)
    return NextResponse.json({ error: e.message || 'فشل إنشاء الرواتب' }, { status: 500 })
  }
}
