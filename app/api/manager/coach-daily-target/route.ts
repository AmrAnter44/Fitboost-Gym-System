import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - المشرف/الإدارة يحدد تارجت الكوتش اليومي (رينج عدد الحصص)
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    //  متاح للمشرف والإدارة (بالدور)، أو صاحب صلاحية حاسبة العمولة
    const role = user.role
    let allowed = role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER'
    if (!allowed) {
      const permission = await prisma.permission.findUnique({
        where: { userId: user.userId },
        select: { canAccessPTCommission: true },
      })
      allowed = !!permission?.canAccessPTCommission
    }
    if (!allowed) {
      return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: 403 })
    }

    const body = await request.json()
    const { coachId } = body
    if (!coachId) {
      return NextResponse.json({ error: 'رقم الكوتش مطلوب' }, { status: 400 })
    }

    //  min/max: أرقام موجبة أو null (مسح التارجت)
    const parse = (v: any): number | null => {
      if (v === null || v === undefined || v === '') return null
      const n = parseInt(String(v), 10)
      return isNaN(n) || n < 0 ? null : n
    }
    let min = parse(body.min)
    let max = parse(body.max)
    //  لو الاتنين موجودين واتقلبوا، نظبّطهم
    if (min !== null && max !== null && min > max) { const t = min; min = max; max = t }

    //  raw SQL — الأعمدة جديدة، آمنة حتى لو الـ Prisma client لسه outdated
    await prisma.$executeRawUnsafe(
      `UPDATE Staff SET dailySessionTargetMin = ?, dailySessionTargetMax = ? WHERE id = ?`,
      min,
      max,
      coachId
    )

    return NextResponse.json({ success: true, dailyTargetMin: min, dailyTargetMax: max })
  } catch (error: any) {
    console.error('Error setting coach daily target:', error)
    return NextResponse.json({ error: 'فشل حفظ التارجت' }, { status: 500 })
  }
}
