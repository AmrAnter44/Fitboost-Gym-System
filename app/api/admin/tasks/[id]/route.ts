import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requireAdmin } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  DELETE — حذف المهمة (بيمسح الإسنادات معاها)
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdmin(request)
    //  relationMode=prisma مبيعملش cascade تلقائي في الـ raw، فنمسح الإسنادات الأول
    await prisma.taskAssignment.deleteMany({ where: { taskId: params.id } })
    await prisma.task.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (String(error?.message || '').includes('Forbidden')) return NextResponse.json({ error: 'مسموح للأدمن فقط' }, { status: 403 })
    console.error('Delete task error:', error)
    return NextResponse.json({ error: 'فشل حذف المهمة' }, { status: 500 })
  }
}
