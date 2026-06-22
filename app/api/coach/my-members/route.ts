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
        coachConversionNote: true,
        coachConversionNoteAt: true,
        //  آخر 5 جلسات PT (مجانية أو مدفوعة) للعضو ده مع نوتس الكوتش
        ptSessions: {
          orderBy: { sessionDate: 'desc' },
          take: 5,
          select: {
            id: true,
            sessionDate: true,
            notes: true,
            isFreeSession: true,
            attended: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    //  لكل عضو، نتحقق إذا له اشتراك PT نشط (لو خلصت حصصه المجانية واشترك)
    // PT بيرتبط بـ Member عن طريق phone بس (مفيش memberId في PT model)
    const memberPhones = members.map(m => m.phone).filter(Boolean) as string[]
    const activePTs = memberPhones.length > 0
      ? await prisma.pT.findMany({
          where: {
            phone: { in: memberPhones },
            expiryDate: { gte: new Date() },
          },
          select: {
            ptNumber: true,
            phone: true,
            sessionsPurchased: true,
            sessionsRemaining: true,
            startDate: true,
            expiryDate: true,
          },
        })
      : []

    //  map: phone → PT info (أحدث اشتراك لو فيه كذا)
    const ptByPhone = new Map<string, typeof activePTs[0]>()
    for (const pt of activePTs) {
      if (pt.phone) ptByPhone.set(pt.phone, pt)
    }

    const enriched = members.map(m => {
      const activePT = m.phone ? ptByPhone.get(m.phone) || null : null
      return {
        ...m,
        //  hasPaidPT: عند العضو اشتراك PT نشط (يعني اتحول من free → paid)
        hasPaidPT: !!activePT,
        activePT,
      }
    })

    return NextResponse.json(enriched)
  } catch (error) {
    console.error('Error fetching coach assigned members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assigned members' },
      { status: 500 }
    )
  }
}
