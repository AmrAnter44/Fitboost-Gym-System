import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { staffIds: string[], startDate, endDate, type, isPaid?, reason? }
// Bulk add the same leave to multiple staff (e.g. Eid leave for all)
export async function POST(request: Request) {
  try {
    await requirePermission(request, 'canApproveLeaves')
    const body = await request.json()
    const { staffIds, startDate, endDate, type, isPaid, reason } = body
    if (!Array.isArray(staffIds) || staffIds.length === 0 || !startDate || !endDate || !type) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) return NextResponse.json({ error: 'تاريخ النهاية قبل تاريخ البداية' }, { status: 400 })

    const result = await prisma.leave.createMany({
      data: staffIds.map((staffId: string) => ({
        staffId, startDate: start, endDate: end, type, isPaid: isPaid ?? true, reason: reason || null, status: 'approved',
      })),
    })
    return NextResponse.json({ count: result.count }, { status: 201 })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية إدارة الإجازات مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
