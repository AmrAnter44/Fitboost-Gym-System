import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const memberPayload = await verifyMemberToken(request);

    if (!memberPayload) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      member: {
        id: memberPayload.memberId,
        memberNumber: memberPayload.memberNumber,
        name: memberPayload.name,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في التحقق من الجلسة' },
      { status: 500 }
    );
  }
}
