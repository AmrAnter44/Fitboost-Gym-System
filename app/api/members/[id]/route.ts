import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

// GET - جلب بيانات عضو واحد (متاح للكوتش بدون صلاحيات خاصة)

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // التحقق من تسجيل الدخول فقط
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }

    const memberId = params.id

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        receipts: true,
        coach: {
          select: {
            id: true,
            name: true,
            staffCode: true
          }
        },
        freezeRequests: {
          where: { status: 'approved' },
          orderBy: { endDate: 'desc' },
          take: 1,
          select: { endDate: true }
        }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'لم يتم العثور على العضو' },
        { status: 404 }
      )
    }

    console.log('👤 جلب بيانات العضو:', {
      id: member.id,
      memberNumber: member.memberNumber,
      name: member.name,
      coachId: member.coachId,
      coach: member.coach ? {
        id: member.coach.id,
        name: member.coach.name,
        staffCode: member.coach.staffCode
      } : 'لا يوجد كوتش'
    })

    return NextResponse.json(member, { status: 200 })
  } catch (error: any) {
    console.error('❌ Error fetching member:', error)
    return NextResponse.json(
      { error: 'فشل جلب بيانات العضو' },
      { status: 500 }
    )
  }
}
