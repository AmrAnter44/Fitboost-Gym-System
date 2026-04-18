import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: { memberNumber: string } }
) {
  try {
    const memberNumber = params.memberNumber

    if (!memberNumber) {
      return NextResponse.json(
        { error: '❌ رقم العضوية مطلوب' },
        { status: 400 }
      )
    }

    // البحث عن العضو برقم العضوية
    const member = await prisma.member.findFirst({
      where: {
        memberNumber: parseInt(memberNumber)
      },
      select: {
        name: true,
        memberNumber: true,
        isActive: true,
        expiryDate: true,
        isBanned: true,
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: '🚨 رقم العضوية غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من الحظر مباشرة من حقل isBanned
    if (member.isBanned) {
      return NextResponse.json({
        name: member.name,
        memberNumber: member.memberNumber,
        status: 'banned',
        message: '🚫 هذا العضو محظور',
        banReason: null,
        bannedBy: null,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // حساب الأيام المتبقية
    let remainingDays: number | null = null
    let status: 'active' | 'warning' | 'expired' = 'expired'
    let message = ''

    if (member.expiryDate) {
      const expiry = new Date(member.expiryDate)
      const today = new Date()
      const diffTime = expiry.getTime() - today.getTime()
      remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (remainingDays < 0) {
        status = 'expired'
        message = '🚨 اشتراكك منتهي'
      } else if (remainingDays <= 7) {
        status = 'warning'
        message = `⚠️ اشتراكك ينتهي قريباً (${remainingDays} يوم)`
      } else {
        status = 'active'
        message = '✅ اشتراكك نشط'
      }
    } else {
      // لا يوجد تاريخ انتهاء
      status = member.isActive ? 'active' : 'expired'
      message = member.isActive ? '✅ اشتراكك نشط' : '🚨 اشتراكك منتهي'
    }

    return NextResponse.json({
      name: member.name,
      memberNumber: member.memberNumber,
      status: status,
      message: message,
      expiryDate: member.expiryDate,
      remainingDays: remainingDays,
      isActive: member.isActive
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error) {
    console.error('Check API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في التحقق' },
      { status: 500 }
    )
  }
}
