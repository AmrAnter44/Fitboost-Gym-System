// 📣 الإيفنتات الجاية — لأبلكيشن الأعضاء (بيانات عامة زي جدول الكلاسات)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const now = new Date()
    // الإيفنت بيفضل ظاهر لحد ما يخلص (أو 3 ساعات بعد بدايته لو مالوش نهاية)
    const events = await prisma.gymEvent.findMany({
      where: {
        isActive: true,
        OR: [
          { endsAt: { gte: now } },
          { endsAt: null, startsAt: { gte: new Date(now.getTime() - 3 * 3600_000) } },
        ],
      },
      orderBy: { startsAt: 'asc' },
      take: 5,
      select: { id: true, title: true, description: true, startsAt: true, endsAt: true },
    })
    return NextResponse.json({ events })
  } catch {
    return NextResponse.json({ events: [] })
  }
}
