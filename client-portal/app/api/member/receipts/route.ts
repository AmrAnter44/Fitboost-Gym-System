import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';
import { getMemberReceipts } from '@/lib/api-client';

/**
 * Get authenticated member's receipts from main system
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

    // Fetch receipts from main system API
    const result = await getMemberReceipts(memberPayload.memberId, {
      limit,
      offset,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get receipts error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
