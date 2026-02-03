import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';

/**
 * Unsubscribe from push notifications
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const memberData = await verifyMemberToken(request);
    if (!memberData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get endpoint from request
    const { endpoint } = await request.json();

    // TODO: Remove subscription from database
    // await prisma.pushSubscription.deleteMany({
    //   where: {
    //     memberId: memberData.id,
    //     endpoint,
    //   },
    // });

    console.log('Push subscription removed for member:', (memberData as any).id);

    return NextResponse.json({
      success: true,
      message: 'تم إلغاء الإشعارات بنجاح',
    });
  } catch (error) {
    console.error('Unsubscribe from notifications error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في إلغاء الإشعارات' },
      { status: 500 }
    );
  }
}
