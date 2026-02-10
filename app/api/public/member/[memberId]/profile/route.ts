import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        phone: true,
        profileImage: true,
        subscriptionPrice: true,
        startDate: true,
        expiryDate: true,
        isActive: true,
        isFrozen: true,
        inBodyScans: true,
        invitations: true,
        freePTSessions: true,
        remainingFreezeDays: true,
        _count: {
          select: {
            receipts: true,
            checkIns: true,
            spaBookings: true,
          },
        },
      },
    });

    if (!member) {
      return NextResponse.json(
        { error: 'العضو غير موجود' },
        { status: 404 }
      );
    }

    // Calculate remaining days
    const today = new Date();
    const expiryDate = member.expiryDate ? new Date(member.expiryDate) : null;

    let remainingDays = 0;
    let status: 'active' | 'expired' | 'expiring_soon' = 'active';

    if (expiryDate) {
      remainingDays = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (remainingDays <= 0) {
        status = 'expired';
        remainingDays = 0;
      } else if (remainingDays <= 7) {
        status = 'expiring_soon';
      }
    }

    // Calculate subscription type based on duration
    let subscriptionType = 'غير محدد';
    if (member.startDate && member.expiryDate) {
      const startDate = new Date(member.startDate);
      const endDate = new Date(member.expiryDate);
      const durationInDays = Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (durationInDays <= 35) {
        subscriptionType = 'شهري';
      } else if (durationInDays <= 100) {
        subscriptionType = '3 شهور';
      } else if (durationInDays <= 190) {
        subscriptionType = '6 شهور';
      } else if (durationInDays <= 380) {
        subscriptionType = 'سنوي';
      } else {
        subscriptionType = `${Math.round(durationInDays / 30)} شهر`;
      }
    }

    return NextResponse.json({
      member: {
        ...member,
        remainingDays,
        status,
        subscriptionType,
      },
    });
  } catch (error) {
    console.error('Get member profile error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
