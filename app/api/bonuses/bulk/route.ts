import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { staffIds: string[], amount, reason, month, year, notes? }
// Bulk add the same bonus to multiple staff (e.g. Eid bonus for all)
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canManagePayroll')
    const body = await request.json()
    const { staffIds, amount, reason, month, year, notes } = body
    if (!Array.isArray(staffIds) || staffIds.length === 0 || !amount || !reason || !month || !year) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    const result = await prisma.bonus.createMany({
      data: staffIds.map((staffId: string) => ({
        staffId, amount, reason, month, year, notes: notes || null,
      })),
    })
    return NextResponse.json({ count: result.count }, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الرواتب مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
