import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// GET - التحقق إذا كان شخص محظوراً بالتليفون أو الرقم القومي
export async function GET(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول أولاً' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const nationalId = searchParams.get('nationalId')

    if (!phone && !nationalId) {
      return NextResponse.json({ isBanned: false })
    }

    const ph = phone?.trim() || null
    const ni = nationalId?.trim() || null

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string
      reason: string | null
      bannedBy: string | null
      createdAt: string | null
    }>>(
      `SELECT id, reason, bannedBy, createdAt FROM BannedMember
       WHERE (phone IS NOT NULL AND phone = ?)
          OR (nationalId IS NOT NULL AND nationalId = ?)
       LIMIT 1`,
      ph,
      ni
    )
    const banned = results[0] || null

    return NextResponse.json({
      isBanned: !!banned,
      reason: banned?.reason || null,
      bannedBy: banned?.bannedBy || null,
      bannedAt: banned?.createdAt || null
    })
  } catch (error: any) {
    return NextResponse.json({ error: 'فشل التحقق' }, { status: 500 })
  }
}
