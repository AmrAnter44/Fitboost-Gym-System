import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * يتحقق أن مقدم الطلب يعرف رقم هاتف العضو (آخر 10 أرقام).
 * بدون هذا التحقق، أي شخص يعرف memberId يستطيع التجميد/الحجز نيابةً عن العضو.
 */
async function verifyMemberPhone(memberId: string, phoneNumber: string | undefined | null): Promise<boolean> {
  if (!phoneNumber || typeof phoneNumber !== 'string') return false;
  const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10);
  if (cleanPhone.length < 7) return false;
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      phone: { contains: cleanPhone }
    },
    select: { id: true }
  });
  return !!member;
}

/**
 * Get member's freeze requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

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

    // 🔒 إثبات هوية العضو بواسطة phone number (shared-secret الخفيف)
    const verified = await verifyMemberPhone(memberId, phoneNumber);
    if (!verified) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم هاتفك لتأكيد الطلب' },
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

    // Create freeze request with auto-approval
    const freezeRequest = await prisma.freezeRequest.create({
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

    // Update member - apply freeze immediately
    const currentExpiryDate = await prisma.member.findUnique({
      where: { id: memberId },
      select: { expiryDate: true },
    });

    if (currentExpiryDate?.expiryDate) {
      const newExpiryDate = new Date(currentExpiryDate.expiryDate);
      newExpiryDate.setDate(newExpiryDate.getDate() + days);

      await prisma.member.update({
        where: { id: memberId },
        data: {
          isFrozen: true,
          expiryDate: newExpiryDate,
          remainingFreezeDays: { decrement: days },
        },
      });
    } else {
      await prisma.member.update({
        where: { id: memberId },
        data: {
          isFrozen: true,
          remainingFreezeDays: { decrement: days },
        },
      });
    }

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
