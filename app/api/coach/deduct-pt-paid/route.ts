import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

// آخر 10 أرقام من الهاتف — لمطابقة الـ PT المرتبط بالعضو
function phoneTailOf(phone?: string | null): string | null {
  const t = phone?.replace(/\D/g, '').slice(-10)
  return t && t.length >= 7 ? t : null
}

// POST - الكوتش يخصم حصة PT مدفوعة لعضو من كلاينتاته
export async function POST(request: Request) {
  try {
    // 1. Auth — لازم COACH
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

    // 2. Body
    const { memberId, ptNumber, notes } = await request.json()
    if (!memberId) {
      return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
    }

    // 3. العضو + التأكد إنه من كلاينتات الكوتش
    const member = await prisma.member.findUnique({ where: { id: memberId } })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }
    if (!member.isActive) {
      return NextResponse.json({ error: 'العضو غير نشط' }, { status: 400 })
    }
    if (member.coachId !== user.staffId) {
      return NextResponse.json({ error: 'هذا العضو غير معين لك' }, { status: 403 })
    }

    const staff = await prisma.staff.findUnique({ where: { id: user.staffId } })
    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'المدرب غير موجود أو غير نشط' }, { status: 404 })
    }

    // 4. تحديد باقة الـ PT المدفوعة للعضو (مربوطة بالهاتف)
    const tail = phoneTailOf(member.phone)
    if (!tail) {
      return NextResponse.json({ error: 'رقم هاتف غير صالح' }, { status: 400 })
    }

    // لو اتبعت ptNumber محدد نستخدمه (بعد التأكد إنه بتاع نفس العضو)، وإلا أحدث باقة فيها رصيد
    let pt: { ptNumber: number; clientName: string; coachName: string; phone: string | null } | null = null
    if (ptNumber !== undefined && ptNumber !== null) {
      const found = await prisma.pT.findUnique({
        where: { ptNumber: parseInt(String(ptNumber), 10) },
        select: { ptNumber: true, clientName: true, coachName: true, phone: true, sessionsRemaining: true },
      })
      // لازم يكون بتاع نفس العضو (نفس آخر 10 أرقام) وفيه رصيد
      if (found && phoneTailOf(found.phone) === tail && (found.sessionsRemaining || 0) > 0) {
        pt = found
      }
    }
    if (!pt) {
      pt = await prisma.pT.findFirst({
        where: { phone: { contains: tail }, sessionsRemaining: { gt: 0 } },
        orderBy: { ptNumber: 'desc' },
        select: { ptNumber: true, clientName: true, coachName: true, phone: true },
      })
    }
    if (!pt) {
      return NextResponse.json({ error: 'لا توجد حصص PT مدفوعة متبقية' }, { status: 400 })
    }

    // 5. خصم ذرّي محمي + إنشاء PTSession
    const result = await prisma.$transaction(async (tx) => {
      const dec = await tx.pT.updateMany({
        where: { ptNumber: pt!.ptNumber, sessionsRemaining: { gt: 0 } },
        data: { sessionsRemaining: { decrement: 1 } },
      })
      if (dec.count === 0) {
        throw new Error('NO_SESSIONS')
      }

      const session = await tx.pTSession.create({
        data: {
          ptNumber: pt!.ptNumber,
          clientName: pt!.clientName || member.name,
          coachName: pt!.coachName || staff.name,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: staff.name,
          notes: (notes && String(notes).trim()) || 'حصة PT مدفوعة - تسجيل بواسطة الكوتش',
          isFreeSession: false,
          memberId: member.id,
        },
      })

      const fresh = await tx.pT.findUnique({
        where: { ptNumber: pt!.ptNumber },
        select: { sessionsRemaining: true, sessionsPurchased: true },
      })

      return { session, fresh }
    })

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حصة PT مدفوعة بنجاح',
      ptNumber: pt.ptNumber,
      sessionsRemaining: result.fresh?.sessionsRemaining ?? null,
      sessionsPurchased: result.fresh?.sessionsPurchased ?? null,
      session: { id: result.session.id, sessionDate: result.session.sessionDate },
    })
  } catch (error: any) {
    if (error?.message === 'NO_SESSIONS') {
      return NextResponse.json({ error: 'لا توجد حصص PT مدفوعة متبقية' }, { status: 400 })
    }
    console.error('Error deducting paid PT session (coach):', error)
    return NextResponse.json({ error: 'فشل تسجيل الحصة' }, { status: 500 })
  }
}
