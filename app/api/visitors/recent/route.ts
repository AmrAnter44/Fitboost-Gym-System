import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requireAnyPermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

//  الداي يوز والدعوات بيتخزّنوا كـ Visitor — مش «زائر جديد» فمابيطلعش ليهم بوب أب
const EXCLUDED_SOURCES = ['invitation', 'member-invitation']
//  أول ما الجهاز يفتح من غير آخر فحص محفوظ: الزوار من الساعة اللي فاتت
const FIRST_WINDOW_MS = 60 * 60 * 1000
//  أقصى رجوع لورا (لو السيستم كان مقفول من امبارح مثلاً)
const MAX_WINDOW_MS = 12 * 60 * 60 * 1000

/**
 * GET /api/visitors/recent?since=<epoch ms>
 * الزوار اللي اتضافوا بعد `since` — للبوب أب «زائر جديد» (VisitorAddedNotifier).
 * من غير `since` (أول مرة على الجهاز ده) → آخر ساعة.
 * مابيرجّعش الزوار اللي المستخدم نفسه ضافهم، والسيلز بيشوف زواره + غير المُسنّدين بس (زي المتابعات).
 */
export async function GET(request: Request) {
  try {
    const user = await requireAnyPermission(request, ['canViewVisitors', 'canViewFollowUps'])
    const now = Date.now()
    const sinceRaw = Number(new URL(request.url).searchParams.get('since'))
    const sinceMs = Number.isFinite(sinceRaw) && sinceRaw > 0 ? sinceRaw : now - FIRST_WINDOW_MS
    const since = new Date(Math.max(sinceMs, now - MAX_WINDOW_MS))

    //  السيلز (من غير إدارة سيلز) → زواره + اللي مش متعيّنين لحد
    let salesScope: string | null = null
    if (user.role !== 'OWNER' && user.role !== 'ADMIN' && user.role !== 'MANAGER' && !user.permissions?.canManageSales) {
      const dbUser: any = await prisma.user.findUnique({ where: { id: user.userId }, select: { isSales: true } as any })
      if (dbUser?.isSales) salesScope = user.staffId || '__none__'
    }

    const visitors = await prisma.visitor.findMany({
      where: { createdAt: { gt: since }, isDeleted: false, source: { notIn: EXCLUDED_SOURCES } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, name: true, phone: true, source: true, createdAt: true,
        followUps: { take: 1, orderBy: { createdAt: 'asc' }, select: { assignedTo: true, assignedStaff: { select: { name: true } } } },
      },
    })
    if (visitors.length === 0) return NextResponse.json({ now, visitors: [] })

    //  مين ضاف الزائر — من سجل الأحداث (CREATE Visitor)
    const logs = await prisma.auditLog.findMany({
      where: { action: 'CREATE', resource: 'Visitor', resourceId: { in: visitors.map(v => v.id) } },
      select: { resourceId: true, userId: true, userName: true },
    })
    const byVisitor = new Map(logs.map(l => [l.resourceId, l]))

    const result = visitors
      .filter(v => byVisitor.get(v.id)?.userId !== user.userId)
      .filter(v => {
        if (!salesScope) return true
        const assigned = v.followUps[0]?.assignedTo
        return !assigned || assigned === salesScope
      })
      .slice(0, 10)
      .map(v => ({
        id: v.id,
        name: v.name,
        phone: v.phone,
        source: v.source,
        createdAt: v.createdAt,
        addedBy: byVisitor.get(v.id)?.userName || null,
        salesName: v.followUps[0]?.assignedStaff?.name || null,
      }))

    return NextResponse.json({ now, visitors: result })
  } catch (error: any) {
    const msg = String(error?.message || '')
    if (msg === 'Unauthorized') return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    if (msg.includes('Forbidden')) return NextResponse.json({ error: 'صلاحية غير كافية' }, { status: 403 })
    console.error('visitors/recent error:', error)
    return NextResponse.json({ error: 'فشل جلب الزوار الجدد' }, { status: 500 })
  }
}
