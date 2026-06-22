import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - متابعة تحويل الفري إلى PT لكل الكباتن
// المسموح لهم: OWNER, ADMIN, MANAGER (الفتنس مانجر), أو اللي عنده canAccessPTCommission
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    //  Permission check
    const role = user.role
    const isAllowed = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
    if (!isAllowed) {
      //  لو مش admin/manager، نتحقق من permission
      const permission = await prisma.permission.findUnique({
        where: { userId: user.userId },
        select: { canAccessPTCommission: true },
      })
      if (!permission?.canAccessPTCommission) {
        return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
      }
    }

    //  1. جلب كل الكباتن النشطين (position فيها "مدرب")
    const coaches = await prisma.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        staffCode: true,
        position: true,
        profileImage: true,
      },
      orderBy: { name: 'asc' },
    })
    const trainers = coaches.filter(c =>
      (c.position?.split(',') || []).map(p => p.trim()).includes('مدرب')
    )

    if (trainers.length === 0) {
      return NextResponse.json([])
    }

    const trainerIds = trainers.map(t => t.id)

    //  2. جلب كل الأعضاء المعينين للكباتن دول
    const members = await prisma.member.findMany({
      where: { coachId: { in: trainerIds } },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        profileImage: true,
        isActive: true,
        expiryDate: true,
        startDate: true,
        freePTSessions: true,
        subscriptionPrice: true,
        coachId: true,
        coachConversionNote: true,
        coachConversionNoteAt: true,
        ptSessions: {
          orderBy: { sessionDate: 'desc' },
          take: 10,
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

    //  3. جلب اشتراكات PT النشطة لكل التليفونات (للتحقق من hasPaidPT)
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
    const ptByPhone = new Map<string, typeof activePTs[0]>()
    for (const pt of activePTs) {
      if (pt.phone) ptByPhone.set(pt.phone, pt)
    }

    //  4. تجميع البيانات حسب الكوتش
    const result = trainers.map(coach => {
      const coachMembers = members
        .filter(m => m.coachId === coach.id)
        .map(m => {
          const activePT = m.phone ? ptByPhone.get(m.phone) || null : null
          //  تصنيف الميمبر:
          // 'subscribed' = اشترك PT بعد كده
          // 'didnt_subscribe' = خلص الفري ومسجل سبب
          // 'pending_decision' = خلص الفري ولسه ما اشتركش ولا اتسجل سبب
          // 'still_has_free' = لسه عنده حصص مجانية
          let status: 'subscribed' | 'didnt_subscribe' | 'pending_decision' | 'still_has_free'
          if (activePT) {
            status = 'subscribed'
          } else if (m.freePTSessions > 0) {
            status = 'still_has_free'
          } else if (m.coachConversionNote) {
            status = 'didnt_subscribe'
          } else {
            status = 'pending_decision'
          }
          return {
            id: m.id,
            memberNumber: m.memberNumber,
            name: m.name,
            phone: m.phone,
            profileImage: m.profileImage,
            isActive: m.isActive,
            startDate: m.startDate,
            expiryDate: m.expiryDate,
            freePTSessions: m.freePTSessions,
            subscriptionPrice: m.subscriptionPrice,
            coachConversionNote: m.coachConversionNote,
            coachConversionNoteAt: m.coachConversionNoteAt,
            ptSessions: m.ptSessions,
            hasPaidPT: !!activePT,
            activePT,
            status,
          }
        })

      //  Stats
      const stats = {
        total: coachMembers.length,
        subscribed: coachMembers.filter(m => m.status === 'subscribed').length,
        didnt_subscribe: coachMembers.filter(m => m.status === 'didnt_subscribe').length,
        pending_decision: coachMembers.filter(m => m.status === 'pending_decision').length,
        still_has_free: coachMembers.filter(m => m.status === 'still_has_free').length,
        //  conversion rate = (اشترك / (اشترك + ما اشترك)) — يستثني اللي لسه عنده فري ولسه ما اتقررش
        conversionRate: (() => {
          const decided = coachMembers.filter(m => m.status === 'subscribed' || m.status === 'didnt_subscribe').length
          if (decided === 0) return null
          return Math.round((coachMembers.filter(m => m.status === 'subscribed').length / decided) * 100)
        })(),
      }

      return {
        coach: {
          id: coach.id,
          name: coach.name,
          staffCode: coach.staffCode,
          profileImage: coach.profileImage,
        },
        stats,
        members: coachMembers,
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching coach conversions:', error)
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}
