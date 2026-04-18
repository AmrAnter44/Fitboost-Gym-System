import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/followups/reopen-expired
 * لما عضو يقرب ينتهي أو ينتهي اشتراكه، نفتح المتابعة المأرشفة بتاعته تاني
 * عشان السجل والتاريخ يفضل محفوظ ويظهر في القائمة
 */
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phones } = await request.json()

    if (!Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ reopened: 0 })
    }

    // جيب الـ visitors اللي عندهم نفس الأرقام دي
    const visitors = await prisma.visitor.findMany({
      where: { phone: { in: phones } },
      select: { id: true, phone: true }
    })

    if (visitors.length === 0) {
      return NextResponse.json({ reopened: 0 })
    }

    const visitorIds = visitors.map(v => v.id)

    // جيب أحدث متابعة مأرشفة لكل visitor (اللي مش عنده متابعة نشطة حالياً)
    const activeFollowUpVisitorIds = await prisma.followUp.findMany({
      where: { visitorId: { in: visitorIds }, archived: false },
      select: { visitorId: true }
    }).then(fus => new Set(fus.map(fu => fu.visitorId)))

    // الـ visitors اللي عندهم أرشيف بس مش عندهم نشط
    const needReopenIds = visitorIds.filter(id => !activeFollowUpVisitorIds.has(id))

    if (needReopenIds.length === 0) {
      return NextResponse.json({ reopened: 0 })
    }

    // جيب أحدث متابعة مأرشفة لكل واحد فيهم
    const archivedFollowUps = await prisma.followUp.findMany({
      where: {
        visitorId: { in: needReopenIds },
        archived: true
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, visitorId: true }
    })

    // خد أحدث واحدة لكل visitor بس
    const latestPerVisitor = new Map<string, string>()
    for (const fu of archivedFollowUps) {
      if (!latestPerVisitor.has(fu.visitorId)) {
        latestPerVisitor.set(fu.visitorId, fu.id)
      }
    }

    const idsToReopen = Array.from(latestPerVisitor.values())

    if (idsToReopen.length === 0) {
      return NextResponse.json({ reopened: 0 })
    }

    // افتح المتابعات دي تاني
    const result = await prisma.followUp.updateMany({
      where: { id: { in: idsToReopen } },
      data: {
        archived: false,
        archivedAt: null,
        archivedReason: null
      }
    })

    return NextResponse.json({ reopened: result.count })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to reopen follow-ups' }, { status: 500 })
  }
}
