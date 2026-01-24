import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'

export const dynamic = 'force-dynamic'


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
        // ✅ معلومات آمنة فقط - بدون معلومات حساسة
        name: true,
        memberNumber: true,
        isActive: true,
        expiryDate: true,
        // ❌ لا نرجع: phone, subscriptionPrice, remainingAmount, staffName, notes
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: '🚨 رقم العضوية غير موجود' },
        { status: 404 }
      )
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

    // ✅ إرجاع معلومات آمنة فقط
    return NextResponse.json({
      name: member.name,
      memberNumber: member.memberNumber,
      status: status,
      message: message,
      expiryDate: member.expiryDate,
      remainingDays: remainingDays,
      isActive: member.isActive
    })

  } catch (error) {
    console.error('Check API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في التحقق' },
      { status: 500 }
    )
  }
}
