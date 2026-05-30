import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAdmin } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await ctx.params
    await prisma.leave.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request)
    const { id } = await ctx.params
    const body = await request.json()
    const data: any = {}
    if (body.startDate) data.startDate = new Date(body.startDate)
    if (body.endDate) data.endDate = new Date(body.endDate)
    if (body.type !== undefined) data.type = body.type
    if (body.isPaid !== undefined) data.isPaid = body.isPaid
    if (body.reason !== undefined) data.reason = body.reason
    if (body.status !== undefined) data.status = body.status
    const updated = await prisma.leave.update({ where: { id }, data })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية المدير مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
