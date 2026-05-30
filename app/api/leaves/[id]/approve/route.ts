import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST { reject?: boolean } — approve or reject a leave request
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, 'canApproveLeaves')
    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))
    const newStatus = body?.reject ? 'rejected' : 'approved'
    const updated = await prisma.leave.update({ where: { id }, data: { status: newStatus } })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية الموافقة على الإجازات مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
