import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - جلب عدد الجلسات المدفوعة النشطة لعضو معين
export async function GET(request: Request) {
  try {
    await requirePermission(request, 'canViewMembers')

    const { searchParams } = new URL(request.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'memberId مطلوب' }, { status: 400 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { phone: true, memberNumber: true }
    })

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // شروط الاشتراك النشط (بدأ + لم ينتهي + جلسات متبقية)
    const phoneWhere = {
      phone: member.phone,
      sessionsRemaining: { gt: 0 },
      OR: [{ startDate: null }, { startDate: { lte: today } }],
      AND: { OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] }
    }

    // جروب كلاسيس: البحث بالهاتف أو رقم العضوية (AND مع باقي الشروط)
    const memberFilter: any[] = [{ phone: member.phone }]
    if (member.memberNumber) {
      memberFilter.push({ memberNumber: member.memberNumber })
    }
    const groupClassWhere = {
      AND: [
        { OR: memberFilter },
        { sessionsRemaining: { gt: 0 } },
        { OR: [{ startDate: null }, { startDate: { lte: today } }] },
        { OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] }
      ]
    }

    // جلب كل الخدمات بالتوازي
    const [ptSessions, nutritionSessions, physioSessions, groupClassSessions] = await Promise.all([
      prisma.pT.findMany({
        where: phoneWhere,
        select: { sessionsRemaining: true }
      }),
      prisma.nutrition.findMany({
        where: phoneWhere,
        select: { sessionsRemaining: true }
      }),
      prisma.physiotherapy.findMany({
        where: phoneWhere,
        select: { sessionsRemaining: true }
      }),
      prisma.groupClass.findMany({
        where: groupClassWhere,
        select: { sessionsRemaining: true }
      })
    ])

    return NextResponse.json({
      pt: ptSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0),
      nutrition: nutritionSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0),
      physio: physioSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0),
      groupClass: groupClassSessions.reduce((sum, s) => sum + s.sessionsRemaining, 0)
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error.message?.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    console.error('Error fetching paid sessions:', error)
    return NextResponse.json({ error: 'فشل جلب الجلسات المدفوعة' }, { status: 500 })
  }
}
