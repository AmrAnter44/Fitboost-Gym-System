import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiCache } from '@/lib/cache'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { verifyMemberPhone } from '@/lib/memberVerify'

export const dynamic = 'force-dynamic'

// آخر 10 أرقام من الهاتف — لمطابقة سجلّ الـ PT المرتبط بالهاتف
function phoneTailOf(phone?: string | null): string | null {
  const t = phone?.replace(/\D/g, '').slice(-10)
  return t && t.length >= 7 ? t : null
}

/**
 * GET — سجلّ حصص الـ PT الخاصة بالعضو (المدفوعة + المجانية).
 * محميّة بتأكيد رقم الهاتف (ضد الـ IDOR).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-pt-sessions',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  try {
    const { memberId } = await params

    // 🔒 تأكيد الملكية برقم الهاتف
    if (!(await verifyMemberPhone(memberId, new URL(request.url).searchParams.get('phone')))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لعرض هذه البيانات' }, { status: 401 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, phone: true },
    })
    if (!member) {
      return NextResponse.json({ sessions: [] })
    }

    // أرقام الـ PT المرتبطة بالعضو عن طريق الهاتف
    const tail = phoneTailOf(member.phone)
    const pts = tail
      ? await prisma.pT.findMany({
          where: { phone: { contains: tail } },
          select: { ptNumber: true },
        })
      : []
    const ptNumbers = pts.map((p) => p.ptNumber)

    // الحصص: المرتبطة بأرقام الـ PT بتاعته، أو الحصص المجانية المسجّلة باسمه
    const orClauses: any[] = []
    if (ptNumbers.length) orClauses.push({ ptNumber: { in: ptNumbers } })
    orClauses.push({ memberId: member.id })

    const sessions = await prisma.pTSession.findMany({
      where: { OR: orClauses },
      orderBy: { sessionDate: 'desc' },
      take: 50,
      select: {
        id: true,
        sessionDate: true,
        coachName: true,
        attended: true,
        notes: true,
        isFreeSession: true,
      },
    })

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Get member PT sessions error:', error)
    return NextResponse.json({ sessions: [] })
  }
}

/**
 * POST — العضو يخصم حصة PT واحدة من رصيده (تسجيل حضور ذاتي من التطبيق).
 * محميّة بتأكيد رقم الهاتف + خصم ذرّي (transaction) يمنع السالب/الـ race.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-pt-deduct',
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  try {
    const { memberId } = await params
    const body = await request.json().catch(() => ({} as any))

    // 🔒 تأكيد الملكية برقم الهاتف (الهاتف بييجي في الـ body للـ POST)
    if (!(await verifyMemberPhone(memberId, body?.phoneNumber))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لتنفيذ هذه العملية' }, { status: 401 })
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, phone: true, isActive: true },
    })
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 })
    }
    if (!member.isActive) {
      return NextResponse.json({ error: 'العضو غير نشط' }, { status: 400 })
    }

    const tail = phoneTailOf(member.phone)
    if (!tail) {
      return NextResponse.json({ error: 'رقم هاتف غير صالح' }, { status: 400 })
    }

    // أحدث باكدج PT فيه حصص متبقية
    const pt = await prisma.pT.findFirst({
      where: { phone: { contains: tail }, sessionsRemaining: { gt: 0 } },
      orderBy: { ptNumber: 'desc' },
      select: { ptNumber: true, clientName: true, coachName: true },
    })
    if (!pt) {
      return NextResponse.json({ error: 'لا توجد حصص متبقية' }, { status: 400 })
    }

    // خصم ذرّي: نُنقص فقط لو لسه فيه رصيد (>0)، وإلا نرمي NO_SESSIONS
    const result = await prisma.$transaction(async (tx) => {
      const dec = await tx.pT.updateMany({
        where: { ptNumber: pt.ptNumber, sessionsRemaining: { gt: 0 } },
        data: { sessionsRemaining: { decrement: 1 } },
      })
      if (dec.count === 0) {
        throw new Error('NO_SESSIONS')
      }

      const session = await tx.pTSession.create({
        data: {
          ptNumber: pt.ptNumber,
          clientName: pt.clientName,
          coachName: pt.coachName,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: 'Member (App)',
          notes: 'تسجيل حضور ذاتي من التطبيق',
          memberId: member.id,
        },
      })

      const fresh = await tx.pT.findUnique({
        where: { ptNumber: pt.ptNumber },
        select: { sessionsRemaining: true, sessionsPurchased: true },
      })

      return { session, fresh }
    })

    // تفريغ كاش الخدمات عشان العدّاد يتحدّث فوراً
    apiCache.delete(`services:${memberId}`)

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضور الحصة',
      sessionsRemaining: result.fresh?.sessionsRemaining ?? null,
      sessionsPurchased: result.fresh?.sessionsPurchased ?? null,
      session: { id: result.session.id, sessionDate: result.session.sessionDate },
    })
  } catch (error: any) {
    if (error?.message === 'NO_SESSIONS') {
      return NextResponse.json({ error: 'لا توجد حصص متبقية' }, { status: 400 })
    }
    console.error('Member deduct PT session error:', error)
    return NextResponse.json({ error: 'فشل خصم الحصة' }, { status: 500 })
  }
}
