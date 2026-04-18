import { NextResponse } from 'next/server'
import { getPointsHistory } from '../../../../../lib/points'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const memberId = params.id

    if (!memberId) {
      return NextResponse.json(
        { error: 'معرف العضو مطلوب' },
        { status: 400 }
      )
    }

    const history = await getPointsHistory(memberId, 20)

    return NextResponse.json(history)
  } catch (error) {
    console.error('Error fetching points history:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في جلب تاريخ النقاط' },
      { status: 500 }
    )
  }
}
