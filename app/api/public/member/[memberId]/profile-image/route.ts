import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiCache } from '@/lib/cache'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  // Rate limit: 10 requests/minute per IP
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'profile-image',
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { memberId } = await params
    const body = await request.json()
    const { imageBase64 } = body

    if (!imageBase64 && imageBase64 !== null) {
      return NextResponse.json(
        { error: 'الصورة مطلوبة' },
        { status: 400 }
      )
    }

    // Verify member exists
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // Update profile image (null to remove)
    await prisma.member.update({
      where: { id: memberId },
      data: { profileImage: imageBase64 },
    })

    // Invalidate profile cache
    apiCache.delete(`profile:${memberId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update profile image error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    )
  }
}
