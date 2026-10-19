import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import {
  verifyMemberPhone,
  verifyPackagePhone,
  parsePackageId,
  memberPhoneFrom,
  phoneTail,
  samePhone,
} from '@/lib/memberVerify'
import { packageBlockReason, packageBlockMessage, PackageBlockReason } from '@/lib/packageUsability'

function isToday(d: Date): boolean {
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

export const dynamic = 'force-dynamic'

type PackageStatus = 'active' | 'frozen' | 'finished' | 'expired'

function statusOf(p: {
  sessionsRemaining: number
  expiryDate: Date | null
  isFrozen?: boolean
  isActive?: boolean
}): PackageStatus {
  if (p.isFrozen) return 'frozen'
  if (p.sessionsRemaining <= 0) return 'finished'
  if (p.isActive === false) return 'expired'
  if (p.expiryDate && p.expiryDate.getTime() < Date.now()) return 'expired'
  return 'active'
}

/** هل الباقة تنفع يتخصم منها حصة + سبب المنع (نفس قواعد مسار الخصم) */
function deductInfo(row: Parameters<typeof packageBlockReason>[0], alreadyToday = false) {
  const reason: PackageBlockReason | null = packageBlockReason(row) ?? (alreadyToday ? 'already-today' : null)
  return {
    canDeduct: reason === null,
    deductBlockReason: reason,
    deductBlockMessage: reason ? packageBlockMessage(reason, row) : null,
  }
}

/**
 * GET — باقات الحصص المخصصة (PT) وخدمات المزيد (More) لصاحب التليفون ده.
 *
 * بيشتغل مع الـ ids بتاعة عملاء الحصص (pt_N / more_N) ومع الأعضاء العاديين.
 * بيرجّع كل سجلات PT و More بنفس التليفون (العميل ممكن يكون عنده أكتر من باقة)
 * + آخر الحصص المسجّلة لكل باقة. المبلغ المتبقي بيظهر بس لو نظام البواقي مفعّل
 * (نفس منطق /profile).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-sessions-package',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  try {
    const { memberId } = await params
    const phone = memberPhoneFrom(request, new URL(request.url).searchParams.get('phone'))

    // 🔒 تأكيد الملكية برقم الهاتف — وبنعتمد على التليفون المتسجّل مش اللي اتبعت
    let storedPhone: string | null = null
    let kind: 'pt' | 'more' | 'member' = 'member'
    if (parsePackageId(memberId)) {
      const pkg = await verifyPackagePhone(memberId, phone)
      if (pkg) {
        storedPhone = pkg.phone
        kind = pkg.kind
      }
    } else if (await verifyMemberPhone(memberId, phone)) {
      const m = await prisma.member.findUnique({ where: { id: memberId }, select: { phone: true } })
      storedPhone = m?.phone ?? null
    }
    if (!storedPhone) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لعرض هذه البيانات' }, { status: 401 })
    }

    const tail = phoneTail(storedPhone)
    if (!tail) {
      return NextResponse.json({ kind, packages: [], hasActive: false })
    }

    const [ptsRaw, moresRaw, settings] = await Promise.all([
      prisma.pT.findMany({
        where: { phone: { contains: tail } },
        orderBy: { ptNumber: 'desc' },
        take: 20,
        select: {
          ptNumber: true, clientName: true, phone: true, coachName: true,
          sessionsPurchased: true, sessionsRemaining: true,
          startDate: true, expiryDate: true, remainingAmount: true,
          isFrozen: true, freezeUntil: true, pendingRenewalData: true, unpaidSessionsLockAt: true,
        },
      }),
      prisma.more.findMany({
        where: { phone: { contains: tail } },
        orderBy: { moreNumber: 'desc' },
        take: 20,
        select: {
          moreNumber: true, clientName: true, phone: true, coachName: true,
          sessionsPurchased: true, sessionsRemaining: true,
          startDate: true, expiryDate: true, remainingAmount: true, isActive: true, unpaidSessionsLockAt: true,
        },
      }),
      prisma.systemSettings.findUnique({ where: { id: 'singleton' }, select: { remainingEnabled: true } }),
    ])

    // مطابقة كاملة للتليفون (contains لوحده ممكن يجيب رقم أطول فيه نفس الذيل)
    const pts = ptsRaw.filter((p) => samePhone(p.phone, storedPhone))
    const mores = moresRaw.filter((m) => samePhone(m.phone, storedPhone))
    const remainingEnabled = settings?.remainingEnabled === true

    const [ptSessions, moreSessions] = await Promise.all([
      pts.length
        ? prisma.pTSession.findMany({
            where: { ptNumber: { in: pts.map((p) => p.ptNumber) } },
            orderBy: { sessionDate: 'desc' },
            take: 200,
            select: { id: true, ptNumber: true, sessionDate: true, coachName: true, attended: true, notes: true, isFreeSession: true },
          })
        : Promise.resolve([]),
      mores.length
        ? prisma.moreSession.findMany({
            where: { moreNumber: { in: mores.map((m) => m.moreNumber) } },
            orderBy: { sessionDate: 'desc' },
            take: 200,
            select: { id: true, moreNumber: true, sessionDate: true, coachName: true, attended: true, notes: true, isFreeSession: true },
          })
        : Promise.resolve([]),
    ])

    const SESSIONS_PER_PACKAGE = 30
    const strip = <T extends { ptNumber?: number; moreNumber?: number }>(s: T) => {
      const { ptNumber: _p, moreNumber: _m, ...rest } = s
      return rest
    }

    const packages = [
      ...pts.map((p) => ({
        type: 'pt' as const,
        number: p.ptNumber,
        clientName: p.clientName,
        coachName: p.coachName,
        sessionsPurchased: p.sessionsPurchased,
        sessionsRemaining: p.sessionsRemaining,
        startDate: p.startDate,
        expiryDate: p.expiryDate,
        remainingAmount: remainingEnabled && (p.remainingAmount ?? 0) > 0 ? p.remainingAmount : null,
        isFrozen: p.isFrozen,
        freezeUntil: p.isFrozen ? p.freezeUntil : null,
        hasPendingRenewal: !!p.pendingRenewalData,
        status: statusOf(p),
        ...deductInfo(p),
        sessions: ptSessions.filter((s) => s.ptNumber === p.ptNumber).slice(0, SESSIONS_PER_PACKAGE).map(strip),
      })),
      ...mores.map((m) => ({
        type: 'more' as const,
        number: m.moreNumber,
        clientName: m.clientName,
        coachName: m.coachName,
        sessionsPurchased: m.sessionsPurchased,
        sessionsRemaining: m.sessionsRemaining,
        startDate: m.startDate,
        expiryDate: m.expiryDate,
        remainingAmount: remainingEnabled && (m.remainingAmount ?? 0) > 0 ? m.remainingAmount : null,
        isFrozen: false,
        freezeUntil: null,
        hasPendingRenewal: false,
        status: statusOf(m),
        ...deductInfo(m, moreSessions.some((s) => s.moreNumber === m.moreNumber && s.attended && isToday(s.sessionDate))),
        sessions: moreSessions.filter((s) => s.moreNumber === m.moreNumber).slice(0, SESSIONS_PER_PACKAGE).map(strip),
      })),
    ]

    // الباقات الشغّالة الأول، وبعدين الأحدث
    const rank: Record<PackageStatus, number> = { active: 0, frozen: 1, finished: 2, expired: 3 }
    packages.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (b.startDate ? new Date(b.startDate).getTime() : 0) - (a.startDate ? new Date(a.startDate).getTime() : 0)
    )

    const totalDue = packages.reduce((sum, p) => sum + (p.remainingAmount ?? 0), 0)

    return NextResponse.json({
      kind,
      // 📱 العميل يقدر يخصم حصة بنفسه من الأبلكيشن (POST ./deduct) — نفس الأعضاء
      // (مفيش إعداد في السيستم بيقفل الخصم الذاتي للأعضاء، فهنا كمان مفتوح دايماً لعملاء الحصص)
      canSelfDeduct: kind !== 'member',
      packages,
      hasActive: packages.some((p) => p.status === 'active' || p.status === 'frozen'),
      totalDue: remainingEnabled ? Math.round(totalDue * 100) / 100 : null,
    })
  } catch (error) {
    console.error('Get sessions package error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ kind: null, packages: [], hasActive: false, totalDue: null })
  }
}
