// 🚪 تقرير البوابات
//
//  التجميع كله SQL على السيرفر — نفس أسلوب
//  `app/api/member-checkin/history/route.ts:80-104`. الواجهة بتعرض بس.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { denyReasonText, type DenyReason } from '@/lib/gates/eligibility'

export const dynamic = 'force-dynamic'

const MAX_ROWS = 300

function dayBounds(s: string | null, fallbackDaysAgo: number) {
  const d = s ? new Date(s) : new Date(Date.now() - fallbackDaysAgo * 86_400_000)
  return isNaN(d.getTime()) ? new Date(Date.now() - fallbackDaysAgo * 86_400_000) : d
}

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ success: false, error: 'مش مسجّل دخول' }, { status: 401 })

    const url = new URL(request.url)
    const from = dayBounds(url.searchParams.get('startDate'), 7)
    from.setHours(0, 0, 0, 0)
    const to = dayBounds(url.searchParams.get('endDate'), 0)
    to.setHours(23, 59, 59, 999)

    const where = { eventTime: { gte: from, lte: to } }

    const [total, allowed, rows, byReason] = await Promise.all([
      prisma.gateEvent.count({ where }),
      prisma.gateEvent.count({ where: { ...where, allowed: true } }),
      prisma.gateEvent.findMany({
        where,
        orderBy: { eventTime: 'desc' },
        take: MAX_ROWS,
        select: {
          id: true, memberId: true, employeeNo: true, eventTime: true,
          allowed: true, reason: true, gateId: true,
        },
      }),
      prisma.gateEvent.groupBy({
        by: ['reason'],
        where: { ...where, allowed: false },
        _count: { _all: true },
      }),
    ])

    //  السلسلة اليومية — SQL خام زي ما بيعمل تقرير الحضور، عشان التجميع
    //  يحصل في الداتابيز مش في الذاكرة
    const daily = (await prisma.$queryRaw<Array<{ day: string; total: bigint; allowed: bigint }>>`
      SELECT date(eventTime / 1000, 'unixepoch', 'localtime') AS day,
             COUNT(*) AS total,
             SUM(CASE WHEN allowed = 1 THEN 1 ELSE 0 END) AS allowed
      FROM GateEvent
      WHERE eventTime >= ${from.getTime()} AND eventTime <= ${to.getTime()}
      GROUP BY day ORDER BY day ASC
    `).map(r => ({ day: r.day, total: Number(r.total), allowed: Number(r.allowed) }))

    const ids = [...new Set(rows.map(r => r.memberId).filter(Boolean))] as string[]
    const members = ids.length
      ? await prisma.member.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, memberNumber: true, phone: true },
        })
      : []
    const byId = new Map(members.map(m => [m.id, m]))

    const gates = await prisma.gate.findMany({ select: { id: true, name: true } })
    const gateName = new Map(gates.map(g => [g.id, g.name]))

    return NextResponse.json({
      success: true,
      range: { from, to },
      stats: {
        total,
        allowed,
        denied: total - allowed,
        //  ليه اترفضوا — ده أهم رقم في التقرير للجيم
        deniedByReason: byReason
          .map(r => ({
            reason: r.reason ?? 'unknown',
            label: r.reason ? (denyReasonText(r.reason as DenyReason) ?? r.reason) : 'غير معروف',
            count: r._count._all,
          }))
          .sort((a, b) => b.count - a.count),
        daily,
      },
      truncated: total > MAX_ROWS,
      events: rows.map(r => {
        const m = r.memberId ? byId.get(r.memberId) : undefined
        return {
          id: r.id,
          at: r.eventTime,
          allowed: r.allowed,
          reason: r.reason,
          reasonText: r.reason && r.reason !== 'ok'
            ? (denyReasonText(r.reason as DenyReason) ?? r.reason)
            : null,
          employeeNo: r.employeeNo,
          gateName: r.gateId ? gateName.get(r.gateId) ?? null : null,
          member: m ? { id: m.id, name: m.name, memberNumber: m.memberNumber, phone: m.phone } : null,
        }
      }),
    })
  } catch (e) {
    console.error('[gates/report]', e)
    return NextResponse.json({ success: false, error: 'حصل خطأ في التقرير' }, { status: 500 })
  }
}
