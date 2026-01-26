import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Get member's freeze requests
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;

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

    return NextResponse.json({
      requests,
    });
  } catch (error) {
    console.error('Get freeze requests error:', error);
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
  { params }: { params: { memberId: string } }
) {
  try {
    const { memberId } = params;
    const body = await request.json();
    const { startDate, days, reason } = body;

    // Validate input
    if (!startDate || !days) {
      return NextResponse.json(
        { error: 'تاريخ البداية وعدد الأيام مطلوبان' },
        { status: 400 }
      );
    }

    if (days <= 0) {
      return NextResponse.json(
        { error: 'عدد الأيام يجب أن يكون أكبر من صفر' },
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
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    if (member.isFrozen) {
      return NextResponse.json(
        { error: 'الاشتراك مجمد حالياً' },
        { status: 400 }
      );
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
      // Extend expiry date by freeze days
      const newExpiryDate = new Date(currentExpiryDate.expiryDate);
      newExpiryDate.setDate(newExpiryDate.getDate() + days);

      await prisma.member.update({
        where: { id: memberId },
        data: {
          isFrozen: true,
          expiryDate: newExpiryDate,
          remainingFreezeDays: {
            decrement: days,
          },
        },
      });
    } else {
      // If no expiry date, just update freeze status
      await prisma.member.update({
        where: { id: memberId },
        data: {
          isFrozen: true,
          remainingFreezeDays: {
            decrement: days,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      request: freezeRequest,
      message: 'تم تطبيق التجميد بنجاح',
    });
  } catch (error) {
    console.error('Create freeze request error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
