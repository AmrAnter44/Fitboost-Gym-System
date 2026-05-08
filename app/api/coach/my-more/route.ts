import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - اشتراكات "مزيد" المعيّن عليها المدرب الحالي
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'هذه الصفحة للمدربين فقط' },
        { status: 403 }
      )
    }

    // ربط بالاسم كـ fallback لو الـ coachUserId مش متخزّن في صفوف قديمة
    const coachStaff = user.staffId
      ? await prisma.staff.findFirst({ where: { id: user.staffId } })
      : await prisma.staff.findFirst({ where: { user: { id: user.userId } } })

    const whereClause = coachStaff
      ? { OR: [{ coachUserId: user.userId }, { coachName: coachStaff.name }] }
      : { coachUserId: user.userId }

    const moreSubscriptions = await prisma.more.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        sessions: {
          orderBy: { sessionDate: 'desc' },
          take: 5,
        },
      },
    })

    return NextResponse.json(moreSubscriptions)
  } catch (error) {
    console.error('Error fetching coach More subscriptions:', error)
    return NextResponse.json(
      { error: 'فشل جلب اشتراكات مزيد' },
      { status: 500 }
    )
  }
}
