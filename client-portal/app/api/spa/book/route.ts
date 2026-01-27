import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';
import { createSpaBooking } from '@/lib/api-client';

/**
 * Create new SPA booking (authenticated)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify JWT token and get member ID
    const memberPayload = await verifyMemberToken(request);

    if (!memberPayload) {
      return NextResponse.json(
        { error: 'غير مصرح. يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { serviceType, bookingDate, bookingTime, duration, notes } = body;

    // Validate input
    if (!serviceType || !bookingDate || !bookingTime || !duration) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      );
    }

    // Create booking via main system API
    const result = await createSpaBooking(memberPayload.memberId, {
      serviceType,
      bookingDate,
      bookingTime,
      duration,
      notes: notes || undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في إنشاء الحجز' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Create SPA booking error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
