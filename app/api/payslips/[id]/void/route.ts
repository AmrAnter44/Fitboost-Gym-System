import { NextResponse } from 'next/server'
import { requirePermission } from '../../../../../lib/auth'
import { voidPayslip } from '../../../../../lib/payroll/voidPayslip'

export const dynamic = 'force-dynamic'

// POST { reason?: string } — void/reverse a payslip
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requirePermission(request, 'canManagePayroll')
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const reason = body?.reason as string | undefined

    await voidPayslip(id, user.userId, reason)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الرواتب مطلوبة' }, { status: 403 })
    if (e.message === 'PAYSLIP_ALREADY_VOIDED') return NextResponse.json({ error: 'الـ payslip ده ملغي بالفعل' }, { status: 400 })
    return NextResponse.json({ error: e.message || 'فشل الإلغاء' }, { status: 500 })
  }
}
