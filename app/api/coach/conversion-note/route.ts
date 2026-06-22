import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// POST - الكوتش بيسجل سبب عدم اشتراك العضو في PT بعد ما خلصت حصصه المجانية
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

    const { memberId, note } = await request.json()

    if (!memberId || typeof note !== 'string' || !note.trim()) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    //  التحقق إن العضو ده فعلاً تابع للكوتش
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, coachId: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }
    if (member.coachId !== user.staffId) {
      return NextResponse.json({ error: 'هذا العضو غير معين لك' }, { status: 403 })
    }

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: {
        coachConversionNote: note.trim(),
        coachConversionNoteAt: new Date(),
      },
      select: {
        coachConversionNote: true,
        coachConversionNoteAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل السبب بنجاح',
      coachConversionNote: updated.coachConversionNote,
      coachConversionNoteAt: updated.coachConversionNoteAt,
    })
  } catch (error: any) {
    console.error('Error saving conversion note:', error)
    return NextResponse.json({ error: 'فشل تسجيل السبب' }, { status: 500 })
  }
}
