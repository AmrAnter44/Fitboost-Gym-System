import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { activatePendingRenewalForMember, readPendingRenewal } from '../../../../lib/pendingRenewal'

// GET - جلب بيانات عضو واحد (متاح للكوتش بدون صلاحيات خاصة)

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    // 🔒 Validate input: member ID format
    const memberId = params.id
    if (!memberId || typeof memberId !== 'string' || memberId.length > 50) {
      return NextResponse.json(
        { error: 'معرف العضو غير صحيح' },
        { status: 400 }
      )
    }

    //  🔁 فعّل التجديد المجدول لو وصل ميعاده قبل ما نجيب بيانات العضو
    try { await activatePendingRenewalForMember(memberId) } catch { /* ignore */ }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        receipts: true,
        coach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        },
        salesStaff: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        },
        dayUses: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, serviceType: true, price: true, createdAt: true, staffName: true }
        },
        freezeRequests: {
          where: { status: 'approved' },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: { startDate: true, endDate: true }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'لم يتم العثور على العضو' },
        { status: 404 }
      )
    }

    // 🔒 Ownership check: COACHes can only access their own members
    const isPrivilegedRole = user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'MANAGER'
    const hasViewPermission = user.permissions?.canViewMembers === true

    if (!isPrivilegedRole && !hasViewPermission) {
      if (user.role === 'COACH') {
        if (!user.staffId || member.coachId !== user.staffId) {
          return NextResponse.json(
            { error: 'ليس لديك صلاحية عرض هذا العضو' },
            { status: 403 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'ليس لديك صلاحية عرض هذا العضو' },
          { status: 403 }
        )
      }
    }

    // 👥 لو في referrerMemberNumber، نجيب بياناته للعرض في الصفحة
    let referrerInfo: { id: string; name: string; memberNumber: string | null } | null = null
    const refNum = (member as any).referrerMemberNumber as string | null
    if (refNum) {
      const ref = await prisma.member.findUnique({
        where: { memberNumber: refNum },
        select: { id: true, name: true, memberNumber: true }
      })
      if (ref) referrerInfo = ref
    }

    // 👥 كل الأعضاء اللي العضو ده جابهم (referredMembers) — للعرض في البروفايل
    let referredMembers: { id: string; name: string; memberNumber: string | null; createdAt: Date; isActive: boolean }[] = []
    if (member.memberNumber) {
      referredMembers = await prisma.member.findMany({
        where: { referrerMemberNumber: member.memberNumber } as any,
        select: { id: true, name: true, memberNumber: true, createdAt: true, isActive: true },
        orderBy: { createdAt: 'desc' }
      })
    }

    // 🏋️ عدد حصص الـ PT المجانية اللي العضو استخدمها فعلاً (من سجلات PTSession المجانية)
    const freePTSessionsUsed = await prisma.pTSession.count({
      where: { memberId: member.id, isFreeSession: true }
    })

    // 📦 الأصل الممنوح من الباقة — للخدمات اللي مبيتعملهاش سجل استخدام (زي الانبودي)
    //    عشان نقدر نعرض "استخدم X من Y" تقريبيًا. مفيش علاقة رسمية فبنجيبها بالـ id.
    let offerBenefits: any = null
    if ((member as any).offerId) {
      offerBenefits = await prisma.offer.findUnique({
        where: { id: (member as any).offerId },
        select: {
          inBodyScans: true,
          invitations: true,
          freezeDays: true,
          maxCheckIns: true,
          freeNutritionSessions: true,
          freePhysioSessions: true,
          freeGroupClassSessions: true,
          freePoolSessions: true,
          freePadelSessions: true,
          freeAssessmentSessions: true,
          freeMoreSessions: true,
        } as any
      })
    }

    // 📤 لو العضوية دي منقولة من عضو تاني، نجيب بياناته للعرض كلينك في البروفايل
    let transferredFrom: { id: string; name: string; memberNumber: string | null; profileImage: string | null } | null = null
    const fromId = (member as any).transferredFromMemberId as string | null
    if (fromId) {
      const src = await prisma.member.findUnique({
        where: { id: fromId },
        select: { id: true, name: true, memberNumber: true, profileImage: true }
      })
      if (src) transferredFrom = src
    }

    //  🔁 التجديد المجدول (لو لسه موجود وما اتفعّلش) — للعرض في بوكس الحالة
    let pendingRenewal: { startDate: string; expiryDate: string | null } | null = null
    try {
      const p = await readPendingRenewal(memberId)
      if (p) pendingRenewal = { startDate: p.startDate.toISOString(), expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null }
    } catch { /* ignore */ }

    return NextResponse.json({
      ...member,
      referrerInfo,
      referredMembers,
      referredMembersCount: referredMembers.length,
      freePTSessionsUsed,
      offerBenefits,
      transferredFrom,
      pendingRenewal,
    }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error fetching member:', error)
    return NextResponse.json(
      { error: 'فشل جلب بيانات العضو' },
      { status: 500 }
    )
  }
}
