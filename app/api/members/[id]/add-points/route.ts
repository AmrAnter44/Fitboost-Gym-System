import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - إضافة/خصم نقاط يدوياً
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const { points, reason } = await request.json()

    // التحقق من البيانات
    if (!points || isNaN(parseInt(points)) || parseInt(points) === 0) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم صحيح للنقاط' },
        { status: 400 }
      )
    }

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: 'يجب إدخال سبب التعديل' },
        { status: 400 }
      )
    }

    const pointsValue = parseInt(points)
    const memberId = params.id

    // التحقق من وجود العضو
    const member = await prisma.member.findUnique({
      where: { id: memberId }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      )
    }

    // التحقق من أن النقاط لن تصبح سالبة
    const newPoints = (member.points || 0) + pointsValue
    if (newPoints < 0) {
      return NextResponse.json(
        { error: `لا يمكن خصم ${Math.abs(pointsValue)} نقطة. الرصيد الحالي: ${member.points || 0} نقطة` },
        { status: 400 }
      )
    }

    // تحديث النقاط وإنشاء سجل في transaction واحدة
    await prisma.$transaction([
      // تحديث نقاط العضو
      prisma.member.update({
        where: { id: memberId },
        data: {
          points: newPoints
        }
      }),

      // إضافة سجل في points history
      prisma.pointsHistory.create({
        data: {
          memberId,
          points: pointsValue,
          action: 'manual',
          description: reason.trim()
        }
      })
    ])

    return NextResponse.json({
      success: true,
      newPoints,
      message: `تم ${pointsValue > 0 ? 'إضافة' : 'خصم'} ${Math.abs(pointsValue)} نقطة بنجاح`
    })
  } catch (error: any) {
    console.error('Error adding points:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث النقاط' },
      { status: 500 }
    )
  }
}
