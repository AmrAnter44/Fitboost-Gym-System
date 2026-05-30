import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth, requireAdmin } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET ?staffId=&from=&to=
// Admin sees all; regular staff only see their own
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN'

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const where: any = {}
    if (isAdmin) {
      if (staffId) where.staffId = staffId
    } else {
      // Staff: force scoping to own records
      if (!user.staffId) return NextResponse.json([], { status: 200 })
      where.staffId = user.staffId
    }
    if (from && to) {
      where.startDate = { lt: new Date(to) }
      where.endDate = { gte: new Date(from) }
    }

    const leaves = await prisma.leave.findMany({
      where,
      orderBy: { startDate: 'desc' },
      include: { staff: { select: { id: true, name: true, staffCode: true } } },
    })
    return NextResponse.json(leaves)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}

// POST { staffId, startDate, endDate, type, isPaid?, reason?, status? }
// Admin can create directly approved. Staff can create pending requests for themselves only.
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
    const isAdmin = user.role === 'OWNER' || user.role === 'ADMIN' || user.permissions?.canApproveLeaves

    const body = await request.json()
    let { staffId, startDate, endDate, type, isPaid, reason, status } = body
    if (!startDate || !endDate || !type) {
      return NextResponse.json({ error: 'البيانات المطلوبة ناقصة' }, { status: 400 })
    }

    if (!isAdmin) {
      // Force self-scoping
      if (!user.staffId) return NextResponse.json({ error: 'لا يوجد حساب موظف مرتبط' }, { status: 400 })
      staffId = user.staffId
      status = 'pending' // Force pending for non-admin requests
      isPaid = undefined // ignore; admin decides on approval
    } else if (!staffId) {
      return NextResponse.json({ error: 'staffId مطلوب' }, { status: 400 })
    }

    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end < start) {
      return NextResponse.json({ error: 'تاريخ النهاية قبل تاريخ البداية' }, { status: 400 })
    }
    const leave = await prisma.leave.create({
      data: {
        staffId,
        startDate: start,
        endDate: end,
        type,
        isPaid: isPaid ?? true,
        reason: reason || null,
        status: status || 'approved',
      },
    })
    return NextResponse.json(leave, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'فشل' }, { status: 500 })
  }
}
