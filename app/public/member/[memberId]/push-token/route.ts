import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Expo } from 'expo-server-sdk';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;
    const body = await request.json();
    const { pushToken } = body;

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

    console.log(`✅ Push token saved for member ${member.name}:`, pushToken);

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
