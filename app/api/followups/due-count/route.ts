import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

//  عدّاد المتابعات المستحقة (محتاجة تواصل) — للبار العام اللي بيظهر في كل الصفحات
//  المتأخرة = nextFollowUpDate قبل بداية النهاردة، والنهاردة = في نطاق اليوم — والاتنين مش متواصل بعد.
//  بنعدّ الـ follow-ups (زي عدّادات صفحة المتابعات overdue/today بالظبط).

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await requirePermission(request, 'canViewFollowUps')

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)

    const [overdue, today, mine] = await Promise.all([
      prisma.followUp.count({
        where: { contacted: false, nextFollowUpDate: { lt: startOfToday } },
      }),
      prisma.followUp.count({
        where: { contacted: false, nextFollowUpDate: { gte: startOfToday, lte: endOfToday } },
      }),
      //  المستحقة المسندة للمستخدم الحالي (لو عنده staffId) — عشان السيلز يشوف بتاعه
      user.staffId
        ? prisma.followUp.count({
            where: {
              contacted: false,
              assignedTo: user.staffId,
              nextFollowUpDate: { lte: endOfToday },
            },
          })
        : Promise.resolve(0),
    ])

    return NextResponse.json({ total: overdue + today, overdue, today, mine })
  } catch (error: any) {
    if (error?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }
    if (typeof error?.message === 'string' && error.message.includes('Forbidden')) {
      //  مفيش صلاحية عرض المتابعات — نرجّع أصفار بدل خطأ عشان البار يختفي بهدوء
      return NextResponse.json({ total: 0, overdue: 0, today: 0, mine: 0 })
    }
    console.error('due-count error:', error)
    return NextResponse.json({ total: 0, overdue: 0, today: 0, mine: 0 })
  }
}
