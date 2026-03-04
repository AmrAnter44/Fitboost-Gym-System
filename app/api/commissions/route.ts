import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { verifyAuth } from '../../../lib/auth'

export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  try {
    // التحقق من المصادقة
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const staffId = searchParams.get('staffId')

    const where: any = {}
    if (type) where.type = type

    // جلب جميع الـ staff IDs الموجودة فعلياً
    const existingStaffIds = await prisma.staff.findMany({
      select: { id: true }
    }).then(staff => staff.map(s => s.id))

    // إذا كان المستخدم COACH، فلتر بناءً على staffId الخاص به
    if (user.role === 'COACH' && user.staffId) {
      // تأكد من أن staffId موجود في القائمة
      if (existingStaffIds.includes(user.staffId)) {
        where.staffId = user.staffId
      } else {
        // إذا كان staff الخاص بالمستخدم محذوف، أرجع قائمة فارغة
        return NextResponse.json([])
      }
    } else if (staffId) {
      // إذا كان Admin وأرسل staffId في query params
      if (existingStaffIds.includes(staffId)) {
        where.staffId = staffId
      } else {
        return NextResponse.json([])
      }
    } else {
      // إذا لم يكن هناك filter محدد، فلتر فقط الموظفين الموجودين
      where.staffId = {
        in: existingStaffIds
      }
    }

    const commissions = await prisma.commission.findMany({
      where,
      include: {
        staff: {
          select: {
            name: true,
            staffCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(commissions)
  } catch (error) {
    console.error('Error fetching commissions:', error)
    return NextResponse.json({ error: 'Failed to fetch commissions' }, { status: 500 })
  }
}
