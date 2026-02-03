import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSpaSlots } from '@/lib/api-client';

// Force dynamic rendering since this route uses request.url
export const dynamic = 'force-dynamic';

/**
 * Get available SPA time slots (public endpoint)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');
    const date = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '60');

    // Validate input
    if (!serviceType || !date) {
      return NextResponse.json(
        { error: 'نوع الخدمة والتاريخ مطلوبان' },
        { status: 400 }
      );
    }

    // Fetch available slots from main system API
    const result = await getAvailableSpaSlots(serviceType, date, duration);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'فشل في جلب البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Get available slots error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
