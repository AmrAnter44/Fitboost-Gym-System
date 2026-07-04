import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Expo } from 'expo-server-sdk';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // 🔒 Rate limit لمنع الـ abuse
    const rl = checkRateLimit(getClientIdentifier(request), {
      id: 'public-push-token',
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error || 'طلبات كثيرة، حاول بعد قليل' },
        { status: 429 }
      );
    }

    const { memberId } = await params;
    const body = await request.json();
    const { pushToken, phoneNumber } = body;

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR: منع تحويل إشعارات أي عضو)
    const verified = await verifyMemberPhone(memberId, phoneNumber);
    if (!verified) {
      return NextResponse.json(
        { error: 'يجب إدخال رقم هاتفك لتأكيد العملية' },
        { status: 401 }
      );
    }

    if (!pushToken) {
      return NextResponse.json(
        { error: 'Push token is required' },
        { status: 400 }
      );
    }

    // Validate push token format
    if (!Expo.isExpoPushToken(pushToken)) {
      return NextResponse.json(
        { error: 'Invalid push token format' },
        { status: 400 }
      );
    }

    // Update member with push token
    const member = await prisma.member.update({
      where: { id: memberId },
      data: { pushToken },
      select: { id: true, name: true, pushToken: true },
    });


    return NextResponse.json({
      success: true,
      message: 'Push token saved successfully',
      member: {
        id: member.id,
        name: member.name,
      },
    });
  } catch (error) {
    console.error('Save push token error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
