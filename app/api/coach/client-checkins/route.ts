import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب عملاء الكوتش اللي عملوا تشيك ان خلال آخر ساعة

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'COACH' && user.role !== 'ADMIN' && user.role !== 'OWNER') {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 403 }
      )
    }

    // جلب اشتراكات PT الخاصة بالكوتش
    const coachPTs = await prisma.pT.findMany({
      where: {
        coachUserId: user.userId,
        sessionsRemaining: { gt: 0 },
      },
      select: {
        ptNumber: true,
        clientName: true,
        phone: true,
      },
    })

    if (coachPTs.length === 0) {
      return NextResponse.json({ checkedInClients: [] })
    }

    // جمع أرقام الهواتف الفريدة
    const phones = [...new Set(coachPTs.map(pt => pt.phone).filter(Boolean))]

    if (phones.length === 0) {
      return NextResponse.json({ checkedInClients: [] })
    }

    // البحث عن الأعضاء بأرقام الهواتف دي
    const members = await prisma.member.findMany({
      where: {
        phone: { in: phones },
      },
      select: {
        id: true,
        phone: true,
        name: true,
      },
    })

    if (members.length === 0) {
      return NextResponse.json({ checkedInClients: [] })
    }

    const memberIds = members.map(m => m.id)

    // البحث عن تشيك ان خلال آخر ساعة
    const oneHourAgo = new Date()
    oneHourAgo.setHours(oneHourAgo.getHours() - 1)

    const recentCheckIns = await prisma.memberCheckIn.findMany({
      where: {
        memberId: { in: memberIds },
        checkInTime: { gte: oneHourAgo },
      },
      select: {
        memberId: true,
        checkInTime: true,
        member: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
    })

    // تحويل النتائج لقائمة أرقام الهواتف اللي عملت تشيك ان
    const checkedInClients = recentCheckIns.map(ci => ({
      phone: ci.member.phone,
      name: ci.member.name,
      checkInTime: ci.checkInTime,
    }))

    return NextResponse.json({ checkedInClients })
  } catch (error) {
    console.error('Error fetching coach client check-ins:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء الاستعلام' },
      { status: 500 }
    )
  }
}
