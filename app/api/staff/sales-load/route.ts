import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/staff/sales-load
// بيرجع موظفين السيلز النشطين مع عدد الأعضاء المعينين لكل واحد
// الهدف: نعرف "الأقل تحميلاً" عشان نختاره أوتوماتيك في فورم إنشاء عضو
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    // 1) موظفين السيلز النشطين (position يحتوي 'sales')
    const allActiveStaff = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, staffCode: true, position: true },
    })
    const salesStaff = allActiveStaff.filter(s =>
      s.position && s.position.split(',').map(p => p.trim()).includes('sales')
    )

    if (salesStaff.length === 0) {
      return NextResponse.json([], { status: 200 })
    }

    // 2) عدد الأعضاء المعينين لكل سيلز (groupBy فيه أداء أحسن من findMany)
    const grouped = await prisma.member.groupBy({
      by: ['salesStaffId'],
      where: { salesStaffId: { in: salesStaff.map(s => s.id) } },
      _count: { _all: true },
    })
    const countById = new Map<string, number>()
    grouped.forEach(g => {
      if (g.salesStaffId) countById.set(g.salesStaffId, g._count._all)
    })

    const result = salesStaff.map(s => ({
      id: s.id,
      name: s.name,
      staffCode: s.staffCode,
      position: s.position,
      memberCount: countById.get(s.id) ?? 0,
    }))

    return NextResponse.json(result, { status: 200 })
  } catch (error: any) {
    console.error('Error in /api/staff/sales-load:', error)
    return NextResponse.json({ error: 'فشل جلب أحمال السيلز' }, { status: 500 })
  }
}
