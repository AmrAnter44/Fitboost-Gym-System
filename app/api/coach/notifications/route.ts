// app/api/coach/notifications/route.ts
//
// Returns 3 categories of notifications for the logged-in coach:
//   - renewals:           PT/Nutrition/Physio/GroupClass/More renewed within last 7 days, scoped to this coach
//   - expiringSoon:       subscriptions whose expiryDate is within next 7 days
//   - halfTimeWithBalance: subscriptions where >half sessions are used AND remainingAmount > 0

import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { RECEIPT_TYPES } from '../../../../lib/receiptTypes'

export const dynamic = 'force-dynamic'

const WINDOW_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

type SubscriptionKind = 'PT' | 'Nutrition' | 'Physiotherapy' | 'GroupClass' | 'More'

interface RenewalItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  amount: number
  daysAgo: number
  receivedAt: string
}

interface ExpiringItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  daysLeft: number
  sessionsRemaining: number
  expiryDate: string
}

interface HalfTimeItem {
  type: SubscriptionKind
  memberName: string
  subscriptionId: number
  sessionsUsed: number
  sessionsTotal: number
  remainingAmount: number
}

interface NewAssignmentItem {
  type: SubscriptionKind | 'Member'
  memberName: string
  subscriptionId?: number
  memberId?: string
  daysAgo: number
  createdAt: string
}

const empty = () => NextResponse.json({
  renewals: [],
  expiringSoon: [],
  halfTimeWithBalance: [],
  newAssignments: [],
})

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // فيتشر مخصصة للكوتشات فقط — أي دور تاني يستلم رد فاضي عشان الـ frontend يخفي البانر
    if (user.role !== 'COACH') return empty()

    const coachStaff = user.staffId
      ? await prisma.staff.findFirst({ where: { id: user.staffId } })
      : await prisma.staff.findFirst({ where: { user: { id: user.userId } } })

    const coachName = coachStaff?.name ?? null
    const coachUserId = user.userId

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - WINDOW_DAYS * DAY_MS)
    const sevenDaysFromNow = new Date(now.getTime() + WINDOW_DAYS * DAY_MS)

    // فلترة scope لكل نوع subscription (مع fallback على الاسم للداتا القديمة)
    const ptScope = coachName
      ? { OR: [{ coachUserId }, { coachName }] }
      : { coachUserId }
    const nutritionScope = coachName
      ? { OR: [{ coachUserId }, { nutritionistName: coachName }] }
      : { coachUserId }
    const physioScope = coachName
      ? { OR: [{ therapistUserId: coachUserId }, { therapistName: coachName }] }
      : { therapistUserId: coachUserId }
    const groupClassScope = coachName
      ? { OR: [{ instructorUserId: coachUserId }, { instructorName: coachName }] }
      : { instructorUserId: coachUserId }
    const moreScope = coachName
      ? { OR: [{ coachUserId }, { coachName }] }
      : { coachUserId }

    // ============================================================
    // 1. تجديدات (آخر ٧ أيام)
    // ============================================================
    const renewalTypes = [
      RECEIPT_TYPES.PT_RENEWAL,
      RECEIPT_TYPES.NUTRITION_RENEWAL,
      RECEIPT_TYPES.PHYSIOTHERAPY_RENEWAL,
      RECEIPT_TYPES.GROUP_CLASS_RENEWAL,
      RECEIPT_TYPES.MORE_RENEWAL,
    ]

    const recentReceipts = await prisma.receipt.findMany({
      where: {
        type: { in: renewalTypes },
        createdAt: { gte: sevenDaysAgo },
        isCancelled: false,
      },
      include: {
        pt: { select: { clientName: true, coachUserId: true, coachName: true, ptNumber: true } },
        nutrition: { select: { clientName: true, coachUserId: true, nutritionistName: true, nutritionNumber: true } },
        physiotherapy: { select: { clientName: true, therapistUserId: true, therapistName: true, physioNumber: true } },
        groupClass: { select: { clientName: true, instructorUserId: true, instructorName: true, classNumber: true } },
        more: { select: { clientName: true, coachUserId: true, coachName: true, moreNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    const renewals: RenewalItem[] = []
    for (const r of recentReceipts) {
      const daysAgo = Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / DAY_MS)

      if (r.type === RECEIPT_TYPES.PT_RENEWAL && r.pt) {
        const isMine = r.pt.coachUserId === coachUserId || (coachName && r.pt.coachName === coachName)
        if (isMine) {
          renewals.push({
            type: 'PT',
            memberName: r.pt.clientName,
            subscriptionId: r.pt.ptNumber,
            amount: r.amount,
            daysAgo,
            receivedAt: r.createdAt.toISOString(),
          })
        }
      } else if (r.type === RECEIPT_TYPES.NUTRITION_RENEWAL && r.nutrition) {
        const isMine = r.nutrition.coachUserId === coachUserId || (coachName && r.nutrition.nutritionistName === coachName)
        if (isMine) {
          renewals.push({
            type: 'Nutrition',
            memberName: r.nutrition.clientName,
            subscriptionId: r.nutrition.nutritionNumber,
            amount: r.amount,
            daysAgo,
            receivedAt: r.createdAt.toISOString(),
          })
        }
      } else if (r.type === RECEIPT_TYPES.PHYSIOTHERAPY_RENEWAL && r.physiotherapy) {
        const isMine = r.physiotherapy.therapistUserId === coachUserId || (coachName && r.physiotherapy.therapistName === coachName)
        if (isMine) {
          renewals.push({
            type: 'Physiotherapy',
            memberName: r.physiotherapy.clientName,
            subscriptionId: r.physiotherapy.physioNumber,
            amount: r.amount,
            daysAgo,
            receivedAt: r.createdAt.toISOString(),
          })
        }
      } else if (r.type === RECEIPT_TYPES.GROUP_CLASS_RENEWAL && r.groupClass) {
        const isMine = r.groupClass.instructorUserId === coachUserId || (coachName && r.groupClass.instructorName === coachName)
        if (isMine) {
          renewals.push({
            type: 'GroupClass',
            memberName: r.groupClass.clientName,
            subscriptionId: r.groupClass.classNumber,
            amount: r.amount,
            daysAgo,
            receivedAt: r.createdAt.toISOString(),
          })
        }
      } else if (r.type === RECEIPT_TYPES.MORE_RENEWAL && r.more) {
        const isMine = r.more.coachUserId === coachUserId || (coachName && r.more.coachName === coachName)
        if (isMine) {
          renewals.push({
            type: 'More',
            memberName: r.more.clientName,
            subscriptionId: r.more.moreNumber,
            amount: r.amount,
            daysAgo,
            receivedAt: r.createdAt.toISOString(),
          })
        }
      }
    }

    // ============================================================
    // 2. قارب على الانتهاء (٧ أيام قدّام)
    // ============================================================
    const expiringSoon: ExpiringItem[] = []

    const expiryRange = { gte: now, lte: sevenDaysFromNow }

    const [expPT, expNut, expPhy, expGc, expMore] = await Promise.all([
      prisma.pT.findMany({
        where: { ...ptScope, expiryDate: expiryRange },
        select: { ptNumber: true, clientName: true, sessionsRemaining: true, expiryDate: true },
      }),
      prisma.nutrition.findMany({
        where: { ...nutritionScope, expiryDate: expiryRange },
        select: { nutritionNumber: true, clientName: true, sessionsRemaining: true, expiryDate: true },
      }),
      prisma.physiotherapy.findMany({
        where: { ...physioScope, expiryDate: expiryRange },
        select: { physioNumber: true, clientName: true, sessionsRemaining: true, expiryDate: true },
      }),
      prisma.groupClass.findMany({
        where: { ...groupClassScope, expiryDate: expiryRange },
        select: { classNumber: true, clientName: true, sessionsRemaining: true, expiryDate: true },
      }),
      prisma.more.findMany({
        where: { ...moreScope, expiryDate: expiryRange },
        select: { moreNumber: true, clientName: true, sessionsRemaining: true, expiryDate: true },
      }),
    ])

    const daysUntil = (date: Date | null): number => {
      if (!date) return 0
      return Math.max(0, Math.ceil((new Date(date).getTime() - now.getTime()) / DAY_MS))
    }

    for (const x of expPT) {
      if (!x.expiryDate) continue
      expiringSoon.push({
        type: 'PT',
        memberName: x.clientName,
        subscriptionId: x.ptNumber,
        daysLeft: daysUntil(x.expiryDate),
        sessionsRemaining: x.sessionsRemaining,
        expiryDate: x.expiryDate.toISOString(),
      })
    }
    for (const x of expNut) {
      if (!x.expiryDate) continue
      expiringSoon.push({
        type: 'Nutrition',
        memberName: x.clientName,
        subscriptionId: x.nutritionNumber,
        daysLeft: daysUntil(x.expiryDate),
        sessionsRemaining: x.sessionsRemaining,
        expiryDate: x.expiryDate.toISOString(),
      })
    }
    for (const x of expPhy) {
      if (!x.expiryDate) continue
      expiringSoon.push({
        type: 'Physiotherapy',
        memberName: x.clientName,
        subscriptionId: x.physioNumber,
        daysLeft: daysUntil(x.expiryDate),
        sessionsRemaining: x.sessionsRemaining,
        expiryDate: x.expiryDate.toISOString(),
      })
    }
    for (const x of expGc) {
      if (!x.expiryDate) continue
      expiringSoon.push({
        type: 'GroupClass',
        memberName: x.clientName,
        subscriptionId: x.classNumber,
        daysLeft: daysUntil(x.expiryDate),
        sessionsRemaining: x.sessionsRemaining,
        expiryDate: x.expiryDate.toISOString(),
      })
    }
    for (const x of expMore) {
      if (!x.expiryDate) continue
      expiringSoon.push({
        type: 'More',
        memberName: x.clientName,
        subscriptionId: x.moreNumber,
        daysLeft: daysUntil(x.expiryDate),
        sessionsRemaining: x.sessionsRemaining,
        expiryDate: x.expiryDate.toISOString(),
      })
    }

    expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft)

    // ============================================================
    // 3. نص الوقت + بواقي
    // ============================================================
    // Prisma/SQLite ما بتدعمش filter expression-based في الـ where مباشرة (مثل: x < y/2)
    // فبنعمل filter على الـ remainingAmount > 0 + expiryDate مش فايت في الـ DB، وبعدين بنفلتر sessionsRemaining < sessionsPurchased/2 في الكود.

    const halfTimeWithBalance: HalfTimeItem[] = []
    const balanceFilter = { remainingAmount: { gt: 0 } }
    // PT/Nutrition/Physio/GroupClass: expiryDate nullable → نقبل null كاشتراك مفتوح
    const notExpiredNullable = { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] }
    // More: expiryDate required (مش nullable في الـ schema) → فلتر مباشر
    const notExpiredRequired = { expiryDate: { gte: now } }

    const [htPT, htNut, htPhy, htGc, htMore] = await Promise.all([
      prisma.pT.findMany({
        where: { AND: [ptScope, balanceFilter, notExpiredNullable] },
        select: { ptNumber: true, clientName: true, sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true },
      }),
      prisma.nutrition.findMany({
        where: { AND: [nutritionScope, balanceFilter, notExpiredNullable] },
        select: { nutritionNumber: true, clientName: true, sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true },
      }),
      prisma.physiotherapy.findMany({
        where: { AND: [physioScope, balanceFilter, notExpiredNullable] },
        select: { physioNumber: true, clientName: true, sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true },
      }),
      prisma.groupClass.findMany({
        where: { AND: [groupClassScope, balanceFilter, notExpiredNullable] },
        select: { classNumber: true, clientName: true, sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true },
      }),
      prisma.more.findMany({
        where: { AND: [moreScope, balanceFilter, notExpiredRequired] },
        select: { moreNumber: true, clientName: true, sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true },
      }),
    ])

    const isHalfTime = (used: number, total: number) => total > 0 && (total - used) < total / 2
    // (sessionsPurchased - sessionsRemaining) > sessionsPurchased / 2 ⟺ sessionsRemaining < sessionsPurchased / 2

    for (const x of htPT) {
      const used = x.sessionsPurchased - x.sessionsRemaining
      if (!isHalfTime(used, x.sessionsPurchased)) continue
      halfTimeWithBalance.push({
        type: 'PT',
        memberName: x.clientName,
        subscriptionId: x.ptNumber,
        sessionsUsed: used,
        sessionsTotal: x.sessionsPurchased,
        remainingAmount: x.remainingAmount ?? 0,
      })
    }
    for (const x of htNut) {
      const used = x.sessionsPurchased - x.sessionsRemaining
      if (!isHalfTime(used, x.sessionsPurchased)) continue
      halfTimeWithBalance.push({
        type: 'Nutrition',
        memberName: x.clientName,
        subscriptionId: x.nutritionNumber,
        sessionsUsed: used,
        sessionsTotal: x.sessionsPurchased,
        remainingAmount: x.remainingAmount ?? 0,
      })
    }
    for (const x of htPhy) {
      const used = x.sessionsPurchased - x.sessionsRemaining
      if (!isHalfTime(used, x.sessionsPurchased)) continue
      halfTimeWithBalance.push({
        type: 'Physiotherapy',
        memberName: x.clientName,
        subscriptionId: x.physioNumber,
        sessionsUsed: used,
        sessionsTotal: x.sessionsPurchased,
        remainingAmount: x.remainingAmount ?? 0,
      })
    }
    for (const x of htGc) {
      const used = x.sessionsPurchased - x.sessionsRemaining
      if (!isHalfTime(used, x.sessionsPurchased)) continue
      halfTimeWithBalance.push({
        type: 'GroupClass',
        memberName: x.clientName,
        subscriptionId: x.classNumber,
        sessionsUsed: used,
        sessionsTotal: x.sessionsPurchased,
        remainingAmount: x.remainingAmount ?? 0,
      })
    }
    for (const x of htMore) {
      const used = x.sessionsPurchased - x.sessionsRemaining
      if (!isHalfTime(used, x.sessionsPurchased)) continue
      halfTimeWithBalance.push({
        type: 'More',
        memberName: x.clientName,
        subscriptionId: x.moreNumber,
        sessionsUsed: used,
        sessionsTotal: x.sessionsPurchased,
        remainingAmount: x.remainingAmount ?? 0,
      })
    }

    // ============================================================
    // 4. أعضاء/اشتراكات جديدة اتأسندوا للكوتش (آخر ٧ أيام)
    // ============================================================
    const newAssignments: NewAssignmentItem[] = []
    const createdRecently = { createdAt: { gte: sevenDaysAgo } }

    const [naPT, naNut, naPhy, naGc, naMore, naMembers] = await Promise.all([
      prisma.pT.findMany({
        where: { AND: [ptScope, createdRecently] },
        select: { ptNumber: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.nutrition.findMany({
        where: { AND: [nutritionScope, createdRecently] },
        select: { nutritionNumber: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.physiotherapy.findMany({
        where: { AND: [physioScope, createdRecently] },
        select: { physioNumber: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.groupClass.findMany({
        where: { AND: [groupClassScope, createdRecently] },
        select: { classNumber: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.more.findMany({
        where: { AND: [moreScope, createdRecently] },
        select: { moreNumber: true, clientName: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      // الأعضاء العامين اللي اتأسندوا لكوتش (Member.coachId)
      coachStaff
        ? prisma.member.findMany({
            where: { coachId: coachStaff.id, ...createdRecently },
            select: { id: true, name: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([] as Array<{ id: string; name: string; createdAt: Date }>),
    ])

    const daysAgo = (date: Date): number =>
      Math.floor((now.getTime() - new Date(date).getTime()) / DAY_MS)

    for (const x of naPT) {
      newAssignments.push({
        type: 'PT',
        memberName: x.clientName,
        subscriptionId: x.ptNumber,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }
    for (const x of naNut) {
      newAssignments.push({
        type: 'Nutrition',
        memberName: x.clientName,
        subscriptionId: x.nutritionNumber,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }
    for (const x of naPhy) {
      newAssignments.push({
        type: 'Physiotherapy',
        memberName: x.clientName,
        subscriptionId: x.physioNumber,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }
    for (const x of naGc) {
      newAssignments.push({
        type: 'GroupClass',
        memberName: x.clientName,
        subscriptionId: x.classNumber,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }
    for (const x of naMore) {
      newAssignments.push({
        type: 'More',
        memberName: x.clientName,
        subscriptionId: x.moreNumber,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }
    for (const x of naMembers) {
      newAssignments.push({
        type: 'Member',
        memberName: x.name,
        memberId: x.id,
        daysAgo: daysAgo(x.createdAt),
        createdAt: x.createdAt.toISOString(),
      })
    }

    newAssignments.sort((a, b) => a.daysAgo - b.daysAgo)

    return NextResponse.json({ renewals, expiringSoon, halfTimeWithBalance, newAssignments })
  } catch (error) {
    console.error('coach/notifications error:', error)
    return NextResponse.json(
      { renewals: [], expiringSoon: [], halfTimeWithBalance: [], newAssignments: [], error: (error as Error).message },
      { status: 500 }
    )
  }
}
