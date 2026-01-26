import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';
import { getMemberSpaBookings } from '@/lib/api-client';

/**
 * Get authenticated member's spa bookings from main system
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

    // Get query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status') || undefined;

    // Fetch spa bookings from main system API
    const result = await getMemberSpaBookings(memberPayload.memberId, {
      limit,
      offset,
      status,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get spa bookings error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
