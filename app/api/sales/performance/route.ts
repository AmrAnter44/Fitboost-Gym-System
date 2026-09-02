// app/api/sales/performance/route.ts
//  إحصائيات أداء السيلز للفترة: لكل سيلز — كام ليد اتسنّدله، كام اتواصل، كام اشترك، ونسبة التحويل.
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
  const role = user.role
  const allowed = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
    || (user as any).permissions?.canManageSales === true
    || (user as any).permissions?.canEditMembers === true
  if (!allowed) return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  try {
    //  فلتر الفترة على تاريخ إنشاء الليد (visitor.createdAt) — Prisma بيتعامل مع الـ DateTime صح
    const visitorWhere: any = { isDeleted: false }
    if (startDate || endDate) {
      visitorWhere.createdAt = {}
      if (startDate) visitorWhere.createdAt.gte = new Date(startDate)
      if (endDate) visitorWhere.createdAt.lte = new Date(endDate.length === 10 ? `${endDate}T23:59:59.999` : endDate)
    }

    const fus = await prisma.followUp.findMany({
      where: { assignedTo: { not: null }, visitor: visitorWhere },
      select: { assignedTo: true, contacted: true, visitorId: true, visitor: { select: { status: true } } },
    })

    //  تجميع لكل سيلز: مجموعات distinct من الـ visitorId
    const map = new Map<string, { assigned: Set<string>; contacted: Set<string>; subscribed: Set<string> }>()
    for (const f of fus) {
      const sid = f.assignedTo as string
      if (!map.has(sid)) map.set(sid, { assigned: new Set(), contacted: new Set(), subscribed: new Set() })
      const e = map.get(sid)!
      e.assigned.add(f.visitorId)
      if (f.contacted) e.contacted.add(f.visitorId)
      if ((f.visitor as any)?.status === 'subscribed') e.subscribed.add(f.visitorId)
    }

    const staff = await prisma.staff.findMany({
      where: { isActive: true, position: { contains: 'sales' } },
      select: { id: true, name: true, staffCode: true },
      orderBy: { name: 'asc' },
    })

    const stats = staff.map(s => {
      const e = map.get(s.id)
      const assigned = e ? e.assigned.size : 0
      const contacted = e ? e.contacted.size : 0
      const subscribed = e ? e.subscribed.size : 0
      const rate = assigned > 0 ? Math.round((subscribed / assigned) * 100) : 0
      return { staffId: s.id, name: s.name, staffCode: s.staffCode, assigned, contacted, subscribed, rate }
    })

    //  ترتيب بالأكثر تحويلاً
    stats.sort((a, b) => b.subscribed - a.subscribed || b.assigned - a.assigned)

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('sales performance error:', error)
    return NextResponse.json({ error: 'فشل جلب الإحصائيات' }, { status: 500 })
  }
}
