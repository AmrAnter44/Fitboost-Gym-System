import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - Coach deducts a free PT session for one of their assigned members
export async function POST(request: Request) {
  try {
    // 1. Auth - must be COACH
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'COACH') {
      return NextResponse.json(
        { error: 'هذه العملية للمدربين فقط' },
        { status: 403 }
      )
    }

    if (!user.staffId) {
      return NextResponse.json({ error: 'لا يوجد staffId للمدرب' }, { status: 400 })
    }

    // 2. Parse body
    const { memberId, notes } = await request.json()

    if (!memberId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    // 3. Get member and verify it's assigned to THIS coach
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    if (!member.isActive) {
      return NextResponse.json({ error: 'العضو غير نشط' }, { status: 400 })
    }

    if (member.coachId !== user.staffId) {
      return NextResponse.json(
        { error: 'هذا العضو غير معين لك' },
        { status: 403 }
      )
    }

    // 4. Check free PT sessions balance
    if (member.freePTSessions <= 0) {
      return NextResponse.json(
        { error: 'لا توجد جلسات PT مجانية متاحة' },
        { status: 400 }
      )
    }

    // 5. Get coach's staff record (for name)
    const staff = await prisma.staff.findUnique({
      where: { id: user.staffId }
    })

    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'المدرب غير موجود أو غير نشط' }, { status: 404 })
    }

    // 6. Transaction ذرّي: خصم حصة مجانية (بشكل آمن ضد الـ race) + إنشاء PTSession
    //    الخصم بيتم بـ updateMany مع شرط (freePTSessions > 0) عشان:
    //    - ميوصلش لسالب، وميحصلش lost-update لو الكوتش دوس مرتين بسرعة.
    const result = await prisma.$transaction(async (tx) => {
      const dec = await tx.member.updateMany({
        where: { id: memberId, freePTSessions: { gt: 0 } },
        data: { freePTSessions: { decrement: 1 } },
      })
      if (dec.count === 0) {
        throw new Error('NO_FREE_SESSIONS')
      }

      const session = await tx.pTSession.create({
        data: {
          ptNumber: 0, // Free session - no PT subscription
          clientName: member.name,
          coachName: staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: notes || `جلسة PT مجانية - تسجيل بواسطة المدرب`,
          isFreeSession: true,
          memberId: member.id
        }
      })

      const fresh = await tx.member.findUnique({
        where: { id: memberId },
        select: { freePTSessions: true },
      })

      return { session, remaining: fresh?.freePTSessions ?? 0 }
    })

    return NextResponse.json({
      success: true,
      message: `تم تسجيل جلسة PT مجانية بنجاح`,
      remainingFree: result.remaining,
      session: {
        id: result.session.id,
        sessionDate: result.session.sessionDate
      }
    })
  } catch (error: any) {
    if (error?.message === 'NO_FREE_SESSIONS') {
      return NextResponse.json(
        { error: 'لا توجد جلسات PT مجانية متاحة' },
        { status: 400 }
      )
    }
    console.error('Error deducting free PT session (coach):', error)
    return NextResponse.json(
      { error: 'فشل تسجيل الجلسة' },
      { status: 500 }
    )
  }
}
