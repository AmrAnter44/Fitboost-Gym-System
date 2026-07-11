import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// حالة اشتراك الـ PT للعضو — يظهر في بروفايل العضو
// endpoint خفيف مستقل عن صلاحية canViewPT: أي مستخدم يقدر يشوف بروفايل العضو يشوف حالته
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

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { phone: true }
    })
    if (!member || !member.phone) {
      return NextResponse.json(null)
    }

    //  بداية النهاردة — بنستخدمها لفحص "لسه ما انتهاش" فقط
    //  (مش بنفحص تاريخ البداية عشان الاشتراك اللي بدأ النهاردة ما يتشالش بسبب فرق التوقيت)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    //  كل اشتراكات PT للعضو اللي لسه فيها حصص — نختار منها اللي مش منتهي (الأحدث)
    const pts = await prisma.pT.findMany({
      where: {
        phone: member.phone,
        sessionsRemaining: { gt: 0 },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        ptNumber: true,
        coachName: true,
        sessionsPurchased: true,
        sessionsRemaining: true,
        remainingAmount: true,
        startDate: true,
        expiryDate: true,
      },
    })

    //  مشترك = عنده باقة فيها حصص متبقية ولسه ما انتهتش
    const activePT = pts.find(pt => !pt.expiryDate || new Date(pt.expiryDate) >= startOfToday) || null

    return NextResponse.json(activePT)
  } catch (error: any) {
    console.error('Error fetching member PT status:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'حدث خطأ في جلب حالة الـ PT' }, { status: 500 })
  }
}
