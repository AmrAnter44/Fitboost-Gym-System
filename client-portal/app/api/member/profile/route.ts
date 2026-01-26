import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';
import { getMemberProfile } from '@/lib/api-client';

/**
 * Get authenticated member's profile from main system
 */
export async function GET(request: NextRequest) {
  try {
    // Verify JWT token and get member ID
    const memberPayload = await verifyMemberToken(request);

    if (!memberPayload) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    // Fetch profile from main system API
    const result = await getMemberProfile(memberPayload.memberId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
