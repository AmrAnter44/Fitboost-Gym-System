import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

export const dynamic = 'force-dynamic';

/**
 * Get member's freeze requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, new URL(request.url).searchParams.get('phone')))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لعرض هذه البيانات' }, { status: 401 });
    }

    const requests = await prisma.freezeRequest.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        days: true,
        reason: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Get freeze requests error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}

/**
 * Create new freeze request
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // 🔒 Rate limit على الـ IP لمنع الـ abuse
    const clientId = getClientIdentifier(request);
    const rl = checkRateLimit(clientId, {
      id: 'public-freeze',
      limit: 5,
      windowMs: 10 * 60 * 1000
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error || 'محاولات كثيرة، حاول بعد قليل' },
        { status: 429 }
      );
    }

    const { memberId } = await params;
    const body = await request.json();
    const { startDate, days, reason, phoneNumber } = body;

    // 🔒 تأكيد الملكية: لازم صاحب الطلب يعرف رقم هاتف العضو (ضد الـ IDOR)
    const verified = await verifyMemberPhone(memberId, phoneNumber);
    if (!verified) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم هاتفك لتأكيد العملية' },
        { status: 401 }
      );
    }

    // Validate input
    if (!startDate || !days) {
      return NextResponse.json(
        { error: 'تاريخ البداية وعدد الأيام مطلوبان' },
        { status: 400 }
      );
    }

    if (days <= 0 || days > 365) {
      return NextResponse.json(
        { error: 'عدد الأيام غير صالح' },
        { status: 400 }
      );
    }

    // Get member to check remaining freeze days
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        remainingFreezeDays: true,
        isFrozen: true,
        expiryDate: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });
    }

    if (member.isFrozen) {
      return NextResponse.json({ error: 'الاشتراك مجمد حالياً' }, { status: 400 });
    }

    if (days > member.remainingFreezeDays) {
      return NextResponse.json(
        { error: `عدد الأيام المتاح: ${member.remainingFreezeDays} يوم فقط` },
        { status: 400 }
      );
    }

    // Calculate end date
    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + days);

    // إنشاء طلب التجميد + تطبيقه على العضو في transaction واحد عشان ميحصلش
    // إن الأيام تتخصم من غير ما يتسجّل طلب (أو العكس).
    const newExpiryDate = member.expiryDate
      ? (() => { const d = new Date(member.expiryDate!); d.setDate(d.getDate() + days); return d; })()
      : null;

    const freezeRequest = await prisma.$transaction(async (tx) => {
      const fr = await tx.freezeRequest.create({
        data: {
          memberId,
          startDate: start,
          endDate: end,
          days,
          reason: reason || null,
          status: 'approved',
          approvedBy: 'تلقائي',
          approvedAt: new Date(),
        },
      });

      await tx.member.update({
        where: { id: memberId },
        data: {
          isFrozen: true,
          ...(newExpiryDate ? { expiryDate: newExpiryDate } : {}),
          remainingFreezeDays: { decrement: days },
        },
      });

      return fr;
    });

    return NextResponse.json({
      success: true,
      request: freezeRequest,
      message: 'تم تطبيق التجميد بنجاح',
    });
  } catch (error) {
    console.error('Create freeze request error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
