import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { isPTReceipt } from '../../../../lib/translateReceiptType'

export const dynamic = 'force-dynamic'

// GET - متابعة تحويل الفري إلى PT لكل الكباتن
// المسموح لهم: OWNER, ADMIN, MANAGER (الفتنس مانجر), أو اللي عنده canAccessPTCommission
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    //  فلتر الفترة الزمنية لحساب المبلغ (اختياري) — لو مفيش، بيحسب كل الفترات
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

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
    //  Staff مفيهاش profileImage — نـ select الـ fields الموجودة بس
    const coaches = await prisma.staff.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        staffCode: true,
        position: true,
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

    //  📊 عدد حصص كل كوتش النهاردة (مجاني + مدفوع) — للتارجت اليومي
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)
    const todaySessionsRaw = await prisma.pTSession.findMany({
      where: { sessionDate: { gte: todayStart, lte: todayEnd } },
      select: { coachName: true },
    })
    const todayByCoach = new Map<string, number>()
    for (const s of todaySessionsRaw) {
      const cn = (s.coachName || '').trim()
      if (!cn) continue
      todayByCoach.set(cn, (todayByCoach.get(cn) || 0) + 1)
    }

    //  🎯 التارجت اليومي لكل كوتش — بـ raw SQL (الأعمدة جديدة، آمنة حتى لو الـ client outdated)
    const targetByCoachId = new Map<string, { min: number | null; max: number | null }>()
    try {
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, dailySessionTargetMin, dailySessionTargetMax FROM Staff WHERE id IN (${trainerIds.map(() => '?').join(',')})`,
        ...trainerIds
      )
      for (const r of rows) {
        targetByCoachId.set(r.id, {
          min: r.dailySessionTargetMin ?? null,
          max: r.dailySessionTargetMax ?? null,
        })
      }
    } catch (e) { /* الأعمدة ممكن تكون لسه مش موجودة — نتعامل كـ null */ }

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
        freeNutritionSessions: true,
        freePhysioSessions: true,
        freeMoreSessions: true,
        subscriptionPrice: true,
        coachId: true,
        //  تاريخ تعيين الكوتش — متى دخل العميل مع الكابتن ده
        coachAssignedAt: true,
        createdAt: true,
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

    //  3. جلب كل اشتراكات PT لكل التليفونات
    //  - "اتحوّل" (subscribed) = اشترى PT أي وقت (حتى لو الاشتراك خلص) → everSubscribedPTPhones
    //  - activePT (للعرض) = الاشتراك اللي لسه شغّال (expiryDate >= now)
    const memberPhones = members.map(m => m.phone).filter(Boolean) as string[]
    const allPTs = memberPhones.length > 0
      ? await prisma.pT.findMany({
          where: { phone: { in: memberPhones } },
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
    const nowDate = new Date()
    const ptByPhone = new Map<string, typeof allPTs[0]>()      // active PT (للعرض)
    const everSubscribedPTPhones = new Set<string>()            // اشترى PT أي وقت (للتحويل)
    for (const pt of allPTs) {
      if (!pt.phone) continue
      everSubscribedPTPhones.add(pt.phone)
      if (pt.expiryDate && new Date(pt.expiryDate) >= nowDate) {
        ptByPhone.set(pt.phone, pt) // الأحدث النشط
      }
    }

    //  3b. اشتراكات التغذية/العلاج الطبيعي/المزيد (أي اشتراك مدفوع = اتحوّل) — بالتليفون
    const [nutritionSubs, physioSubs, moreSubs] = memberPhones.length > 0
      ? await Promise.all([
          prisma.nutrition.findMany({ where: { phone: { in: memberPhones } }, select: { phone: true } }),
          prisma.physiotherapy.findMany({ where: { phone: { in: memberPhones } }, select: { phone: true } }),
          prisma.more.findMany({ where: { phone: { in: memberPhones } }, select: { phone: true } }),
        ])
      : [[], [], []]
    const nutritionPhones = new Set(nutritionSubs.map(n => n.phone).filter(Boolean))
    const physioPhones = new Set(physioSubs.map(p => p.phone).filter(Boolean))
    const morePhones = new Set(moreSubs.map(m => m.phone).filter(Boolean))

    //  3c. إجمالي المبلغ اللي دخله كل كابتن — من إيصالات PT الفعلية (غير الملغية)
    //  بنجمع amount الإيصال حسب اسم الكوتش المخزّن في itemDetails (نفس منطق التقارير/التقفيل)
    //  مع فلترة الفترة الزمنية لو متبعتة
    const receiptWhere: any = { isCancelled: false }
    if (startDate || endDate) {
      receiptWhere.createdAt = {}
      if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); receiptWhere.createdAt.gte = s }
      if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); receiptWhere.createdAt.lte = e }
    }
    const ptReceipts = await prisma.receipt.findMany({
      where: receiptWhere,
      select: { type: true, amount: true, itemDetails: true, ptNumber: true },
    })
    //  🔗 خريطة رقم الـ PT → الكوتش الحقيقي — أدق من اسم الكوتش المكتوب في الإيصال
    const cvPtNums = Array.from(new Set(ptReceipts.map(r => r.ptNumber).filter((n): n is number => n != null)))
    const cvPtRows = cvPtNums.length
      ? await prisma.pT.findMany({ where: { ptNumber: { in: cvPtNums } }, select: { ptNumber: true, coachName: true } })
      : []
    const cvPtNumToCoach = new Map<number, string>()
    cvPtRows.forEach(p => { if (p.coachName) cvPtNumToCoach.set(p.ptNumber, p.coachName.trim()) })

    const revenueByCoach = new Map<string, number>()
    for (const r of ptReceipts) {
      if (!isPTReceipt(r.type)) continue
      let coachName = ''
      //  رقم الـ PT هو الحَكَم
      if (r.ptNumber != null && cvPtNumToCoach.has(r.ptNumber)) {
        coachName = cvPtNumToCoach.get(r.ptNumber) || ''
      } else {
        try {
          const details = r.itemDetails ? JSON.parse(r.itemDetails) : {}
          coachName = (details.coachName || '').trim()
        } catch { coachName = '' }
      }
      if (!coachName) continue
      revenueByCoach.set(coachName, (revenueByCoach.get(coachName) || 0) + (r.amount || 0))
    }

    //  حالة خدمة لكل عضو: subscribed (اشترى) / free (لسه عنده مجاني) / none
    const serviceStatus = (subscribed: boolean, freeCount: number): 'subscribed' | 'free' | 'none' =>
      subscribed ? 'subscribed' : (freeCount > 0 ? 'free' : 'none')

    //  4. تجميع البيانات حسب الكوتش
    const result = trainers.map(coach => {
      const coachMembers = members
        .filter(m => m.coachId === coach.id)
        .map(m => {
          const activePT = m.phone ? ptByPhone.get(m.phone) || null : null
          const everSubscribedPT = m.phone ? everSubscribedPTPhones.has(m.phone) : false
          //  تصنيف الميمبر:
          // 'subscribed' = اشترى PT أي وقت (حتى لو خلص) — اتحوّل
          // 'still_has_free' = لسه عنده حصص مجانية ولسه ما اشتراش
          // 'didnt_subscribe' = خلص الفري ومسجل سبب عدم الاشتراك
          // 'pending_decision' = خلص الفري ولسه ما اشتركش ولا اتسجل سبب
          let status: 'subscribed' | 'didnt_subscribe' | 'pending_decision' | 'still_has_free'
          if (everSubscribedPT) {
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
            //  تاريخ دخول الكلاينت مع الكابتن — fallback لـ createdAt للأعضاء القدامى
            joinedCoachAt: (m as any).coachAssignedAt || m.createdAt,
            ptSessions: m.ptSessions,
            hasPaidPT: everSubscribedPT,
            activePT,
            status,
            //  حالة العضو في باقي الخدمات (عرض مدمج)
            services: {
              nutrition: serviceStatus(m.phone ? nutritionPhones.has(m.phone) : false, m.freeNutritionSessions || 0),
              physio: serviceStatus(m.phone ? physioPhones.has(m.phone) : false, m.freePhysioSessions || 0),
              more: serviceStatus(m.phone ? morePhones.has(m.phone) : false, m.freeMoreSessions || 0),
            },
          }
        })

      //  Stats
      const stats = {
        total: coachMembers.length,
        subscribed: coachMembers.filter(m => m.status === 'subscribed').length,
        didnt_subscribe: coachMembers.filter(m => m.status === 'didnt_subscribe').length,
        pending_decision: coachMembers.filter(m => m.status === 'pending_decision').length,
        still_has_free: coachMembers.filter(m => m.status === 'still_has_free').length,
        //  conversion rate = اللي اتحوّلوا ÷ إجمالي عملاء الكابتن
        conversionRate: (() => {
          const total = coachMembers.length
          if (total === 0) return null
          return Math.round((coachMembers.filter(m => m.status === 'subscribed').length / total) * 100)
        })(),
        //  إجمالي المبلغ اللي دخله الكابتن من إيصالات PT
        revenue: revenueByCoach.get((coach.name || '').trim()) || 0,
      }

      return {
        coach: {
          id: coach.id,
          name: coach.name,
          staffCode: coach.staffCode,
          //  التارجت اليومي (رينج) + عدد حصص النهاردة
          dailyTargetMin: targetByCoachId.get(coach.id)?.min ?? null,
          dailyTargetMax: targetByCoachId.get(coach.id)?.max ?? null,
          todaySessions: todayByCoach.get((coach.name || '').trim()) || 0,
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
