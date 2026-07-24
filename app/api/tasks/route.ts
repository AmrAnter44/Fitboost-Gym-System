import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

//  GET — مهامي (المسنَدة للمستخدم الحالي)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const rows = await prisma.taskAssignment.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { task: true },
    })

    const tasks = rows.map((r) => ({
      taskId: r.taskId,
      status: r.status,
      completedAt: r.completedAt,
      title: r.task.title,
      description: r.task.description,
      dueDate: r.task.dueDate,
      priority: r.task.priority,
      createdByName: r.task.createdByName,
      createdAt: r.task.createdAt,
    }))
    //  المفتوحة الأول، وبعدها حسب أقرب deadline
    tasks.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'pending' ? -1 : 1
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
      return ad - bd
    })

    return NextResponse.json({ tasks })
  } catch (error) {
    console.error('My tasks error:', error)
    return NextResponse.json({ error: 'فشل تحميل المهام' }, { status: 500 })
  }
}
