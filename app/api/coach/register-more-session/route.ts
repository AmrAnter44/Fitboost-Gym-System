import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - Coach registers an attendance session on a More subscription they own
export async function POST(request: Request) {
  try {
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

    const { moreNumber, signature, notes } = await request.json()

    if (!moreNumber) {
      return NextResponse.json({ error: 'رقم الاشتراك مطلوب' }, { status: 400 })
    }

    const more = await prisma.more.findUnique({
      where: { moreNumber: parseInt(moreNumber) },
    })

    if (!more) {
      return NextResponse.json({ error: 'الاشتراك غير موجود' }, { status: 404 })
    }

    // ربط الكوتش باسمه كـ fallback لو الصف القديم مش متخزّن فيه coachUserId
    const coachStaff = user.staffId
      ? await prisma.staff.findUnique({ where: { id: user.staffId } })
      : await prisma.staff.findFirst({ where: { user: { id: user.userId } } })

    const isMyClient =
      more.coachUserId === user.userId ||
      (coachStaff?.name && more.coachName === coachStaff.name)

    if (!isMyClient) {
      return NextResponse.json(
        { error: 'هذا الاشتراك غير معيّن لك' },
        { status: 403 }
      )
    }

    if (!more.isActive) {
      return NextResponse.json({ error: 'الاشتراك غير نشط' }, { status: 400 })
    }

    if (more.sessionsRemaining <= 0) {
      return NextResponse.json({ error: 'لا توجد جلسات متبقية' }, { status: 400 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (more.startDate) {
      const startDay = new Date(more.startDate)
      startDay.setHours(0, 0, 0, 0)
      if (startDay > today) {
        return NextResponse.json({ error: 'الاشتراك لم يبدأ بعد' }, { status: 400 })
      }
    }

    if (more.expiryDate) {
      const expiryDay = new Date(more.expiryDate)
      expiryDay.setHours(0, 0, 0, 0)
      if (expiryDay < today) {
        return NextResponse.json({ error: 'الاشتراك منتهي' }, { status: 400 })
      }
    }

    // signature بنخزّنه في notes كـ data URL لأن الـ schema الحالي مفهوش column
    // مخصص له (نفس الفكرة المستخدمة في PT لما الـ migration بتاع التوقيع لسه ما اتطبّقش)
    const finalNotes = signature
      ? [notes, `signature:${signature}`].filter(Boolean).join('\n')
      : notes || null

    const result = await prisma.$transaction(
      async (tx) => {
        const session = await tx.moreSession.create({
          data: {
            moreNumber: parseInt(moreNumber),
            clientName: more.clientName,
            coachName: more.coachName,
            sessionDate: new Date(),
            attended: true,
            attendedAt: new Date(),
            attendedBy: coachStaff?.name || user.name || user.email,
            notes: finalNotes,
            isFreeSession: false,
          },
        })

        const updateData: any = { sessionsRemaining: more.sessionsRemaining - 1 }
        if (!more.coachUserId) {
          updateData.coachUserId = user.userId
        }

        const updatedMore = await tx.more.update({
          where: { moreNumber: parseInt(moreNumber) },
          data: updateData,
        })

        return { session, updatedMore }
      },
      { maxWait: 60000, timeout: 60000 }
    )

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل الحصة بنجاح',
      sessionsRemaining: result.updatedMore.sessionsRemaining,
      session: { id: result.session.id, sessionDate: result.session.sessionDate },
    })
  } catch (error: any) {
    console.error('Error registering More session (coach):', error)
    return NextResponse.json(
      { error: 'فشل تسجيل الحصة' },
      { status: 500 }
    )
  }
}
