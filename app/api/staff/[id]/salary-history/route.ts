import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, 'canManageStaffSalaries')
    const { id } = await ctx.params
    const history = await prisma.salaryChangeLog.findMany({
      where: { staffId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(history)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية تعديل الرواتب مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
