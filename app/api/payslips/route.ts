import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET ?staffId=&year=&month=  → list payslips
// Permission:
//  - OWNER/ADMIN: anyone
//  - COACH/other staff: only their own (staffId must match user.staffId)
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const staffId = searchParams.get('staffId')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : undefined

    const isStaff = user.role !== 'OWNER' && user.role !== 'ADMIN'

    let effectiveStaffId = staffId
    if (isStaff) {
      // Force scoping to own records
      if (!user.staffId) return NextResponse.json([], { status: 200 })
      effectiveStaffId = user.staffId
    }

    const where: any = {}
    if (effectiveStaffId) where.staffId = effectiveStaffId
    if (year) where.year = year
    if (month) where.month = month

    const payslips = await prisma.payslip.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
      include: {
        staff: { select: { id: true, name: true, staffCode: true, position: true } },
      },
    })

    return NextResponse.json(payslips)
  } catch (e: any) {
    console.error('Payslips list error:', e)
    return NextResponse.json({ error: e.message || 'فشل جلب الرواتب' }, { status: 500 })
  }
}
