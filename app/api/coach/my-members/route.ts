import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب الأعضاء المعينين للمدرب (assigned via coachId)

export const dynamic = 'force-dynamic'

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

    if (!user.staffId) {
      return NextResponse.json({ error: 'لا يوجد staffId للمدرب' }, { status: 400 })
    }

    // 🐛 BUG FIX: كان فيه OR filter بيستثني الأعضاء النشطين (isActive + expiryDate في المستقبل + memberNumber)،
    // فالكوتش لو معاه عضو اشتراكه ساري وعنده حصص PT مجانية ما كانش بيشوفه في الصفحة دي.
    // الـ page UI أصلاً مصمّم يعرض زرار "خصم حصة PT" للأعضاء النشطين بس، فالـ filter كان غلط منطقياً.
    // دلوقتي بنرجّع كل الأعضاء المعيّنين للكوتش (نشط + منتهي + غير نشط) والـ UI بيعالج كل حالة.
    const members = await prisma.member.findMany({
      where: {
        coachId: user.staffId,
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        profileImage: true,
        isActive: true,
        startDate: true,
        expiryDate: true,
        freePTSessions: true,
        subscriptionPrice: true,
        remainingAmount: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching coach assigned members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assigned members' },
      { status: 500 }
    )
  }
}
