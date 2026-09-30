import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone, memberPhoneFrom } from '@/lib/memberVerify';

export const dynamic = 'force-dynamic';

/**
 * PATCH — العضو يلغي حجز SPA بتاعه من الأبلكيشن.
 * مسموح بس لحجز العضو نفسه، وحالته pending/confirmed، ولسه ميعاده ماجاش.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string; bookingId: string }> }
) {
  try {
    const rl = checkRateLimit(getClientIdentifier(request), {
      id: 'public-spa-cancel',
      limit: 10,
      windowMs: 60_000,
    });
    if (!rl.success) {
      return NextResponse.json({ error: rl.error || 'طلبات كثيرة، حاول بعد قليل' }, { status: 429 });
    }

    const { memberId, bookingId } = await params;
    const body = await request.json().catch(() => ({} as any));

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, memberPhoneFrom(request, body?.phoneNumber ?? new URL(request.url).searchParams.get('phone'))))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لتأكيد العملية' }, { status: 401 });
    }

    const booking = await prisma.spaBooking.findUnique({
      where: { id: bookingId },
      select: { id: true, memberId: true, status: true, bookingDate: true, bookingTime: true },
    });
    if (!booking || booking.memberId !== memberId) {
      return NextResponse.json({ error: 'الحجز غير موجود' }, { status: 404 });
    }
    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return NextResponse.json({ error: 'لا يمكن إلغاء هذا الحجز' }, { status: 400 });
    }

    // ميعاد الحجز (التاريخ + الساعة) لازم يكون لسه ماجاش
    const start = new Date(booking.bookingDate);
    const [h, m] = String(booking.bookingTime || '').split(':').map((x) => parseInt(x, 10));
    if (!Number.isNaN(h)) start.setHours(h, Number.isNaN(m) ? 0 : m, 0, 0);
    if (start.getTime() < Date.now()) {
      return NextResponse.json({ error: 'ميعاد الحجز عدّى — لا يمكن إلغاؤه' }, { status: 400 });
    }

    // تحديث ذرّي: مايتلغيش لو الإدارة غيّرت حالته في نفس اللحظة
    const res = await prisma.spaBooking.updateMany({
      where: { id: booking.id, memberId, status: { in: ['pending', 'confirmed'] } },
      data: { status: 'cancelled' },
    });
    if (res.count === 0) {
      return NextResponse.json({ error: 'لا يمكن إلغاء هذا الحجز' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'تم إلغاء الحجز' });
  } catch (error) {
    console.error('Member cancel spa booking error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
