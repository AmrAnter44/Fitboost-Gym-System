import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// DELETE — remove a contact log entry (corrections / typos)
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission(request, 'canEditPT')
    const { id } = await ctx.params
    await prisma.pTContactLog.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (e.message?.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية تعديل الـ PT مطلوبة' }, { status: 403 })
    return NextResponse.json({ error: e.message || 'فشل الحذف' }, { status: 500 })
  }
}
