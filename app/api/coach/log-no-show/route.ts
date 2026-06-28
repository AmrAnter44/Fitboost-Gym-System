import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - الكوتش يسجل ملاحظة عن عدم حضور العميل بدون خصم حصة من رصيده
export async function POST(request: Request) {
  try {
    const user = await verifyAuth(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (user.role !== 'COACH') {
      return NextResponse.json({ error: 'هذه العملية للمدربين فقط' }, { status: 403 })
    }
    if (!user.staffId) {
      return NextResponse.json({ error: 'لا يوجد staffId للمدرب' }, { status: 400 })
    }

    const { memberId, notes } = await request.json()
    if (!memberId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    //  التحقق من العضو وأنه مُسنَّد للكوتش الحالي
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }
    if (member.coachId !== user.staffId) {
      return NextResponse.json({ error: 'هذا العضو غير معين لك' }, { status: 403 })
    }

    //  جلب اسم الكوتش
    const staff = await prisma.staff.findUnique({ where: { id: user.staffId } })
    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'المدرب غير موجود أو غير نشط' }, { status: 404 })
    }

    //  إنشاء PTSession بـ attended=false (مفيش خصم من الحصص)
    const session = await prisma.pTSession.create({
      data: {
        ptNumber: 0,
        clientName: member.name,
        coachName: staff.name,
        sessionDate: new Date(),
        attended: false, //  العميل ما حضرش
        attendedAt: null,
        attendedBy: null,
        notes: notes?.trim() || 'العميل ما حضرش',
        isFreeSession: true,
        memberId: member.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل عدم الحضور بنجاح',
      session: {
        id: session.id,
        sessionDate: session.sessionDate,
      },
    })
  } catch (error: any) {
    console.error('Error logging no-show:', error)
    return NextResponse.json({ error: 'فشل تسجيل عدم الحضور' }, { status: 500 })
  }
}
