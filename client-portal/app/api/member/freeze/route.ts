import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';
import { getMemberFreezeRequests, createFreezeRequest } from '@/lib/api-client';

/**
 * Get authenticated member's freeze requests
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

    // Fetch freeze requests from main system API
    const result = await getMemberFreezeRequests(memberPayload.memberId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
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

    // Create freeze request via main system API
    const result = await createFreezeRequest(memberPayload.memberId, {
      startDate,
      days,
      reason: reason || null,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في إنشاء الطلب' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Create freeze request error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
