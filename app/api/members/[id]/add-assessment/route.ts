import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - إضافة تقييم يدوياً
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

    const { type, value, notes } = await request.json()

    // التحقق من البيانات
    if (!notes || !notes.trim()) {
      return NextResponse.json(
        { error: 'يجب إدخال ملاحظات حول التقييم' },
        { status: 400 }
      )
    }

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

    // إضافة التقييم
    const assessment = await prisma.assessmentHistory.create({
      data: {
        memberId,
        type: type || 'manual',
        value: value ? parseFloat(value) : null,
        notes: notes.trim()
      }
    })

    return NextResponse.json({
      success: true,
      assessment,
      message: 'تم إضافة التقييم بنجاح'
    })
  } catch (error: any) {
    console.error('Error adding assessment:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إضافة التقييم' },
      { status: 500 }
    )
  }
}
