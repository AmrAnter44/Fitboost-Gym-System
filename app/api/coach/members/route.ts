import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب جميع الأعضاء للمدرب (مع حالة اختبار اللياقة)

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    // التحقق من أن المستخدم مدرب
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

    // جلب جميع الأعضاء مع معلومات اختبار اللياقة
    const members = await prisma.member.findMany({
      orderBy: { memberNumber: 'desc' },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        freePTSessions: true,
        fitnessTest: {
          select: {
            id: true,
            createdAt: true,
            coachId: true,
          },
        },
      },
    })

    return NextResponse.json(members)
  } catch (error) {
    console.error('Error fetching members for coach:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
