import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiCache, CACHE_TTL } from '@/lib/cache';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  // Rate limit: 60 requests/minute per IP
  const rl = checkRateLimit(getClientIdentifier(request), {
    id: 'public-services',
    limit: 60,
    windowMs: 60_000,
  })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'طلبات كثيرة جداً، حاول بعد قليل' },
      { status: 429 }
    )
  }

  try {
    const { memberId } = await params;

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, new URL(request.url).searchParams.get('phone')))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لعرض هذه البيانات' }, { status: 401 });
    }

    const cacheKey = `services:${memberId}`
    const cached = apiCache.get<object>(cacheKey)
    if (cached) {
      return NextResponse.json(cached, { headers: { 'X-Cache': 'HIT' } })
    }

    // Get member's memberNumber (needed to link Nutrition/Physio/GroupClass)
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { memberNumber: true, phone: true },
    })

    if (!member) {
      return NextResponse.json({ services: null })
    }

    // آخر 10 أرقام من هاتف العضو — لمطابقة سجلّ الـ PT المرتبط بالهاتف
    const phoneTail = member.phone?.replace(/\D/g, '').slice(-10)

    // Run all service queries in parallel
    const [ptReceipt, ptByPhone, nutritionRecord, physioRecord, groupClassRecord] = await Promise.all([
      // PT (المصدر 1): مرتبط عبر Receipt فيه memberId + ptNumber
      prisma.receipt.findFirst({
        where: {
          memberId,
          ptNumber: { not: null },
          pt: { sessionsRemaining: { gt: 0 } },
        },
        select: {
          pt: {
            select: {
              sessionsRemaining: true,
              sessionsPurchased: true,
              coachName: true,
            },
          },
        },
        orderBy: { id: 'desc' },
      }),

      // PT (المصدر 2 / fallback): مرتبط مباشرةً بهاتف العضو (PT.phone).
      // كثير من باكدجات الـ PT بتتسجّل بالهاتف من غير إيصال فيه memberId،
      // فالمصدر الأول لوحده بيرجّع null بالغلط. ده بيغطّي الحالة دي.
      phoneTail && phoneTail.length >= 7
        ? prisma.pT.findFirst({
            where: {
              phone: { contains: phoneTail },
              sessionsRemaining: { gt: 0 },
            },
            select: {
              sessionsRemaining: true,
              sessionsPurchased: true,
              coachName: true,
            },
            orderBy: { ptNumber: 'desc' },
          })
        : null,

      // Nutrition: linked via memberNumber
      member.memberNumber
        ? prisma.nutrition.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { nutritionNumber: 'desc' },
          })
        : null,

      // Physiotherapy: linked via memberNumber
      member.memberNumber
        ? prisma.physiotherapy.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { physioNumber: 'desc' },
          })
        : null,

      // Group Classes: linked via memberNumber
      member.memberNumber
        ? prisma.groupClass.findFirst({
            where: {
              memberNumber: member.memberNumber,
              sessionsRemaining: { gt: 0 },
            },
            select: { sessionsRemaining: true },
            orderBy: { classNumber: 'desc' },
          })
        : null,
    ])

    // اختَر الـ PT من الإيصال أو من هاتف العضو (أيّهما وُجد)
    const pt = ptReceipt?.pt ?? ptByPhone

    // Check coach online status
    let coachOnline = false
    if (pt?.coachName) {
      const staffRecord = await prisma.staff.findFirst({
        where: {
          name: { contains: pt.coachName },
          isActive: true,
        },
        select: { id: true },
      })
      if (staffRecord) {
        const latestAttendance = await prisma.attendance.findFirst({
          where: { staffId: staffRecord.id },
          orderBy: { checkIn: 'desc' },
          select: { checkIn: true, checkOut: true },
        })
        if (latestAttendance) {
          const twelveHoursInMs = 12 * 60 * 60 * 1000
          const timeDiff = Date.now() - new Date(latestAttendance.checkIn).getTime()
          coachOnline = timeDiff < twelveHoursInMs && !latestAttendance.checkOut
        }
      }
    }

    const services = {
      pt: pt
        ? {
            sessionsRemaining: pt.sessionsRemaining,
            sessionsPurchased: pt.sessionsPurchased,
            coachName: pt.coachName,
            coachOnline,
          }
        : null,
      nutrition: nutritionRecord
        ? { sessionsRemaining: nutritionRecord.sessionsRemaining }
        : null,
      physiotherapy: physioRecord
        ? { sessionsRemaining: physioRecord.sessionsRemaining }
        : null,
      groupClass: groupClassRecord
        ? { sessionsRemaining: groupClassRecord.sessionsRemaining }
        : null,
    }

    const result = { services }

    apiCache.set(cacheKey, result, CACHE_TTL.SPA) // 30s TTL

    return NextResponse.json(result, { headers: { 'X-Cache': 'MISS' } })
  } catch (error) {
    console.error('Get member services error:', error);
    return NextResponse.json({ services: null })
  }
}
