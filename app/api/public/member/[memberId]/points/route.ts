import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'

// Helper function to get reason text with translations
function getReasonText(action: string): { ar: string; en: string } {
  switch (action) {
    case 'check-in':
      return { ar: 'تسجيل الحضور', en: 'Attendance Check-in' }
    case 'invitation':
      return { ar: 'استخدام دعوة', en: 'Invitation Used' }
    case 'payment':
      return { ar: 'دفع مبلغ', en: 'Payment Reward' }
    default:
      return { ar: action, en: action }
  }
}

// Get member points history
export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-member-points',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { memberId } = params

    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID required' },
        { status: 400 }
      )
    }

    // Get member to verify they exist
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        points: true,
      },
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // Get points history
    const pointsHistory = await prisma.pointsHistory.findMany({
      where: {
        memberId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Last 100 transactions
    })

    // Transform history to match mobile app format
    const transactions = pointsHistory.map((item) => {
      // If description exists, try to detect language and provide both
      let reasonAr = item.description || ''
      let reasonEn = item.description || ''

      if (!item.description) {
        const translations = getReasonText(item.action)
        reasonAr = translations.ar
        reasonEn = translations.en
      }

      return {
        id: item.id,
        type: item.points > 0 ? 'earned' : 'redeemed',
        points: Math.abs(item.points),
        reason: reasonAr, // Default to Arabic for backward compatibility
        reasonAr,
        reasonEn,
        createdAt: item.createdAt.toISOString(),
      }
    })

    // Return format that matches the mobile app's expectations
    return NextResponse.json({
      currentPoints: member.points,
      transactions,
    })
  } catch (error) {
    console.error('Get points history error:', error)
    return NextResponse.json(
      { error: 'فشل جلب تاريخ النقاط' },
      { status: 500 }
    )
  }
}
