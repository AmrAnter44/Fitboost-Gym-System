import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { verifyPackagePhone, parsePackageId, memberPhoneFrom, samePhone } from '@/lib/memberVerify'
import { activatePendingPTIfNeeded } from '@/lib/ptPendingRenewal'
import { isPaymentLocked, paymentLockMessage } from '@/lib/sessionPaymentLimit'
import { packageBlockReason, packageBlockMessage } from '@/lib/packageUsability'
import { createAuditLog, getIpAddress, getUserAgent } from '@/lib/auditLog'

export const dynamic = 'force-dynamic'

class DeductError extends Error {}

/**
 * POST — عميل الحصص (pt_N / more_N) بيخصم حصة واحدة بنفسه من الأبلكيشن.
 * body: { kind: 'pt' | 'more', number, phoneNumber? }
 *
 * نفس قواعد خصم العضو من الأبلكيشن (member/[id]/pt-sessions POST) + قواعد سكان
 * المزيد (more/scan): تأكيد التليفون، الباقة لازم تكون بنفس التليفون، حصص باقية،
 * بدأت ومش منتهية، مش متجمّدة، حد الدفع، خصم ذرّي، و More حصة واحدة في اليوم.
 * الـ PT بيفعّل التجديد المؤجّل لو الحصص خلصت. أي خطأ بيرجع رسالة عربي (مش 500).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-package-deduct',
    limit: 10,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  try {
    const { memberId } = await params
    const body = await request.json().catch(() => ({} as any))

    // الخصم من هنا لعملاء الحصص بس — الأعضاء ليهم مسار pt-sessions
    if (!parsePackageId(memberId)) {
      return NextResponse.json({ error: 'غير متاح لهذا الحساب' }, { status: 403 })
    }

    // 🔒 تأكيد الملكية برقم الهاتف
    const owner = await verifyPackagePhone(memberId, memberPhoneFrom(request, body?.phoneNumber))
    if (!owner) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لتنفيذ هذه العملية' }, { status: 401 })
    }

    const kind = body?.kind === 'pt' || body?.kind === 'more' ? (body.kind as 'pt' | 'more') : null
    const number = Number(body?.number)
    if (!kind || !Number.isSafeInteger(number) || number <= 0) {
      return NextResponse.json({ error: 'بيانات الباقة غير صحيحة' }, { status: 400 })
    }

    if (kind === 'pt') {
      const pt = await prisma.pT.findUnique({
        where: { ptNumber: number },
        select: {
          ptNumber: true, clientName: true, coachName: true, phone: true,
          sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true, unpaidSessionsLockAt: true,
          startDate: true, expiryDate: true, isFrozen: true,
        },
      })
      // 🔒 الباقة لازم تكون بتاعة نفس التليفون اللي اتأكد
      if (!pt || !samePhone(pt.phone, owner.phone)) {
        return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
      }
      const reason = packageBlockReason(pt)
      if (reason) {
        return NextResponse.json({ error: packageBlockMessage(reason, pt), reason }, { status: 400 })
      }

      const result = await prisma.$transaction(async (tx) => {
        //  🔒 إعادة فحص القفل ببيانات طازة جوّه الترانزاكشن (زي مسار العضو)
        const current = await tx.pT.findUnique({
          where: { ptNumber: number },
          select: { sessionsRemaining: true, remainingAmount: true, unpaidSessionsLockAt: true },
        })
        if (current && isPaymentLocked(current)) throw new DeductError(paymentLockMessage(current))

        const dec = await tx.pT.updateMany({
          where: { ptNumber: number, sessionsRemaining: { gt: 0 } },
          data: { sessionsRemaining: { decrement: 1 } },
        })
        if (dec.count === 0) throw new DeductError('لا توجد حصص متبقية')

        const session = await tx.pTSession.create({
          data: {
            ptNumber: number,
            clientName: pt.clientName,
            coachName: pt.coachName,
            sessionDate: new Date(),
            attended: true,
            attendedAt: new Date(),
            attendedBy: 'Member (App)',
            notes: 'تسجيل حضور ذاتي من التطبيق',
          },
        })

        //  🔁 لو الحصص خلصت وفيه تجديد مؤجّل → فعّله تلقائي
        await activatePendingPTIfNeeded(tx, number)

        const fresh = await tx.pT.findUnique({
          where: { ptNumber: number },
          select: { sessionsRemaining: true, sessionsPurchased: true },
        })
        return { session, fresh }
      })

      createAuditLog({
        userName: pt.clientName,
        action: 'CREATE', resource: 'PT', resourceId: result.session.id,
        details: { via: 'member-app', ptNumber: number, sessionsRemaining: result.fresh?.sessionsRemaining ?? null },
        ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        message: 'تم تسجيل حضور الحصة',
        sessionsRemaining: result.fresh?.sessionsRemaining ?? null,
        sessionsPurchased: result.fresh?.sessionsPurchased ?? null,
        session: { id: result.session.id, sessionDate: result.session.sessionDate },
      })
    }

    // ── More ──
    const more = await prisma.more.findUnique({
      where: { moreNumber: number },
      select: {
        moreNumber: true, clientName: true, coachName: true, phone: true,
        sessionsRemaining: true, sessionsPurchased: true, remainingAmount: true, unpaidSessionsLockAt: true,
        startDate: true, expiryDate: true, isActive: true,
      },
    })
    if (!more || !samePhone(more.phone, owner.phone)) {
      return NextResponse.json({ error: 'الباقة غير موجودة' }, { status: 404 })
    }
    const reason = packageBlockReason(more)
    if (reason) {
      return NextResponse.json({ error: packageBlockMessage(reason, more), reason }, { status: 400 })
    }

    //  🛡️ مرة واحدة في اليوم (نفس سكان المزيد)
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999)
    const already = await prisma.moreSession.findFirst({
      where: { moreNumber: number, attended: true, attendedAt: { gte: startOfDay, lte: endOfDay } },
      select: { id: true },
    })
    if (already) {
      return NextResponse.json({ error: packageBlockMessage('already-today', more), reason: 'already-today' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.more.findUnique({
        where: { moreNumber: number },
        select: { sessionsRemaining: true, remainingAmount: true, unpaidSessionsLockAt: true },
      })
      if (current && isPaymentLocked(current)) throw new DeductError(paymentLockMessage(current))

      const dec = await tx.more.updateMany({
        where: { moreNumber: number, sessionsRemaining: { gt: 0 } },
        data: { sessionsRemaining: { decrement: 1 } },
      })
      if (dec.count === 0) throw new DeductError('لا توجد حصص متبقية')

      const session = await tx.moreSession.create({
        data: {
          moreNumber: number,
          clientName: more.clientName,
          coachName: more.coachName,
          sessionDate: new Date(),
          attended: true,
          attendedAt: new Date(),
          attendedBy: 'Member (App)',
          notes: 'تسجيل حضور ذاتي من التطبيق',
          isFreeSession: false,
        },
      })
      const fresh = await tx.more.findUnique({
        where: { moreNumber: number },
        select: { sessionsRemaining: true, sessionsPurchased: true },
      })
      return { session, fresh }
    })

    createAuditLog({
      userName: more.clientName,
      action: 'CREATE', resource: 'More', resourceId: result.session.id,
      details: { via: 'member-app', moreNumber: number, sessionsRemaining: result.fresh?.sessionsRemaining ?? null },
      ipAddress: getIpAddress(request), userAgent: getUserAgent(request), status: 'success',
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      message: 'تم تسجيل حضور الحصة',
      sessionsRemaining: result.fresh?.sessionsRemaining ?? null,
      sessionsPurchased: result.fresh?.sessionsPurchased ?? null,
      session: { id: result.session.id, sessionDate: result.session.sessionDate },
    })
  } catch (error) {
    if (error instanceof DeductError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Package deduct error:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'فشل خصم الحصة، حاول تاني' }, { status: 400 })
  }
}
