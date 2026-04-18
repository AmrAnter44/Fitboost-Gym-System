import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - جلب سجل التقييمات
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const memberId = params.id

    // جلب سجل التقييمات مرتب من الأحدث للأقدم
    const history = await prisma.assessmentHistory.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(history)
  } catch (error: any) {
    console.error('Error fetching assessment history:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب سجل التقييمات' },
      { status: 500 }
    )
  }
}
