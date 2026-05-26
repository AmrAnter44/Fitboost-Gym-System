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

    // "Potential" = a member assigned to this coach who is NOT currently
    // an active subscriber. The moment a member becomes active+unexpired,
    // they drop off this list.
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const members = await prisma.member.findMany({
      where: {
        coachId: user.staffId,
        OR: [
          { isActive: false },                  // غير نشط
          { expiryDate: null },                 // مفيش تاريخ انتهاء (مش مشترك)
          { expiryDate: { lt: today } },        // انتهى اشتراكه
          { memberNumber: null },               // مفيش رقم عضوية (محتمل خالص)
        ],
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
