import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'


/**
 * POST /api/members/fix-status
 * One-time fix for members with future expiryDate but isActive=false
 */
export async function POST(request: Request) {
  try {
    // التحقق من صلاحية تعديل الأعضاء
    await requirePermission(request, 'canEditMembers')

    const now = new Date()

    // جلب جميع الأعضاء الذين لديهم تاريخ انتهاء في المستقبل لكن حالتهم غير نشطة
    const membersToFix = await prisma.member.findMany({
      where: {
        isActive: false,
        expiryDate: {
          gt: now
        }
      }
    })


    // تحديث جميع هؤلاء الأعضاء
    const updateResult = await prisma.member.updateMany({
      where: {
        isActive: false,
        expiryDate: {
          gt: now
        }
      },
      data: {
        isActive: true
      }
    })


    return NextResponse.json({
      success: true,
      message: `تم تصحيح حالة ${updateResult.count} عضو بنجاح`,
      fixedCount: updateResult.count,
      members: membersToFix.map(m => ({
        id: m.id,
        name: m.name,
        expiryDate: m.expiryDate,
        daysRemaining: m.expiryDate
          ? Math.ceil((new Date(m.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0
      }))
    })

  } catch (error: any) {
    console.error('❌ خطأ في تصحيح حالة الأعضاء:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    if (error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'ليس لديك صلاحية تعديل الأعضاء' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      error: 'حدث خطأ أثناء تصحيح حالة الأعضاء'
    }, { status: 500 })
  }
}
