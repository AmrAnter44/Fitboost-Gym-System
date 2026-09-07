import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

export const dynamic = 'force-dynamic';

/**
 * العضو بيوافق على الشروط والأحكام من التطبيق.
 * بنسجّل وقت الموافقة على العضو عشان تفضل محفوظة حتى لو مسح التطبيق ونزّله تاني.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const rl = checkRateLimit(getClientIdentifier(request), {
      id: 'public-accept-terms',
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error || 'محاولات كثيرة، حاول بعد قليل' },
        { status: 429 }
      );
    }

    const { memberId } = await params;
    const payload = await request.json().catch(() => ({}));

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, payload?.phoneNumber))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لتأكيد العملية' }, { status: 401 });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { termsAcceptedAt: true },
    });
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });
    }

    // موافقة متسجّلة قبل كده؟ منسيبش التاريخ الأصلي يتغيّر
    const acceptedAt = member.termsAcceptedAt ?? new Date();
    if (!member.termsAcceptedAt) {
      await prisma.member.update({
        where: { id: memberId },
        data: { termsAcceptedAt: acceptedAt },
      });
    }

    return NextResponse.json({ success: true, termsAcceptedAt: acceptedAt });
  } catch (error) {
    console.error('Accept terms error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
