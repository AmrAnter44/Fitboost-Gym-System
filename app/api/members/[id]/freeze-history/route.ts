import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberId = params.id

    if (!memberId) {
      return NextResponse.json({ error: 'معرف العضو مطلوب' }, { status: 400 })
    }

    // كل طلبات الفريز للعضو (الأحدث أولاً) - سجل كامل بكل الحالات
    const history = await prisma.freezeRequest.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        days: true,
        reason: true,
        status: true,
        isBack: true,
        approvedBy: true,
        approvedAt: true,
        createdAt: true
      } as any
    })

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Error fetching freeze history:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'حدث خطأ في جلب سجل التجميد' }, { status: 500 })
  }
}
