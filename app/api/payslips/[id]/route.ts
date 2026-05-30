import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth, requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET — تفاصيل payslip واحد
// Staff can only access their own
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const { id } = await ctx.params
    const payslip = await prisma.payslip.findUnique({
      where: { id },
      include: {
        staff: { select: { id: true, name: true, staffCode: true, position: true, phone: true } },
      },
    })

    if (!payslip) return NextResponse.json({ error: 'الإيصال غير موجود' }, { status: 404 })

    const isStaff = user.role !== 'OWNER' && user.role !== 'ADMIN'
    if (isStaff && payslip.staffId !== user.staffId) {
      return NextResponse.json({ error: 'غير مسموح' }, { status: 403 })
    }

    // breakdown is stored as JSON string — parse it for the client
    let parsedBreakdown = null
    try {
      parsedBreakdown = JSON.parse(payslip.breakdown)
    } catch {}

    return NextResponse.json({ ...payslip, breakdown: parsedBreakdown })
  } catch (e: any) {
    console.error('Payslip GET error:', e)
    return NextResponse.json({ error: e.message || 'فشل جلب الإيصال' }, { status: 500 })
  }
}

// DELETE — حذف الـ payslip (للـ OWNER فقط)
// ملاحظة: ده مش بيرجع التأثير على Deductions/Loans! لازم يدوياً يتصلّحوا.
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request)
    if (user.role !== 'OWNER') {
      return NextResponse.json({ error: 'صلاحية الـ Owner مطلوبة' }, { status: 403 })
    }
    const { id } = await ctx.params
    await prisma.payslip.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    console.error('Payslip DELETE error:', e)
    return NextResponse.json({ error: e.message || 'فشل حذف الإيصال' }, { status: 500 })
  }
}
