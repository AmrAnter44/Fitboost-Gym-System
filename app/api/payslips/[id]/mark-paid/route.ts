import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAdmin } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST — mark a payslip as paid (or unpaid by sending { unpaid: true })
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin(request)
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const unpaid = body?.unpaid === true

    const paymentMethod = (body?.paymentMethod as string | undefined) || null
    const paymentNote = (body?.paymentNote as string | undefined) || null
    const updated = await prisma.payslip.update({
      where: { id },
      data: unpaid
        ? { paidAt: null, paidBy: null, paymentMethod: null, paymentNote: null }
        : { paidAt: new Date(), paidBy: user.userId, paymentMethod, paymentNote },
    })

    return NextResponse.json(updated)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل التحديث' }, { status: 500 })
  }
}
