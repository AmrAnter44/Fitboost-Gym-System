import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  PATCH — الموظف يعلّم مهمته خلصت / يرجّعها (id = taskId)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const b = await request.json().catch(() => ({}))
    const status = b.status === 'done' ? 'done' : 'pending'

    //  نحدّث إسناد المستخدم نفسه بس (ضد الـ IDOR)
    const res = await prisma.taskAssignment.updateMany({
      where: { taskId: params.id, userId: user.userId },
      data: { status, completedAt: status === 'done' ? new Date() : null },
    })
    if (res.count === 0) return NextResponse.json({ error: 'المهمة مش مسنَدة ليك' }, { status: 404 })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update my task error:', error)
    return NextResponse.json({ error: 'فشل تحديث المهمة' }, { status: 500 })
  }
}
