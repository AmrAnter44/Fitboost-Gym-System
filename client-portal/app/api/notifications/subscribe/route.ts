import { NextRequest, NextResponse } from 'next/server';
import { verifyMemberToken } from '@/lib/auth';

/**
 * Subscribe to push notifications
 * Saves the push subscription to the database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const memberData = await verifyMemberToken(request);
    if (!memberData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get subscription data from request
    const subscription = await request.json();

    // TODO: Save subscription to database
    // Example structure:
    // await prisma.pushSubscription.create({
    //   data: {
    //     memberId: memberData.id,
    //     endpoint: subscription.endpoint,
    //     keys: subscription.keys,
    //   },
    // });

    console.log('Push subscription saved for member:', memberData.id);
    console.log('Subscription:', subscription);

    return NextResponse.json({
      success: true,
      message: 'تم تفعيل الإشعارات بنجاح',
    });
  } catch (error) {
    console.error('Subscribe to notifications error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ في تفعيل الإشعارات' },
      { status: 500 }
    );
  }
}
