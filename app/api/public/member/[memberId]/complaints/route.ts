import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { verifyMemberPhone } from '@/lib/memberVerify';

export const dynamic = 'force-dynamic';

const BODY_MAX = 1000;
const SUBJECT_MAX = 120;

/**
 * شكاوى العضو نفسه — بيشوف اللي بعته والردّ عليه (resolution) من الإدارة.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const { memberId } = await params;

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, new URL(request.url).searchParams.get('phone')))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لعرض هذه البيانات' }, { status: 401 });
    }

    const complaints = await prisma.complaint.findMany({
      where: { memberId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      // ملحوظة: مش بنرجّع createdBy — اسم الموظف بيانات داخلية مش للعضو
      select: {
        id: true,
        subject: true,
        body: true,
        status: true,
        resolution: true,
        source: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      complaints,
      stats: {
        total: complaints.length,
        open: complaints.filter((c) => c.status === 'open').length,
        resolved: complaints.filter((c) => c.status === 'resolved').length,
      },
    });
  } catch (error) {
    console.error('Get member complaints error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

/**
 * العضو بيبعت شكوى جديدة من التطبيق.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    // 🔒 Rate limit على الـ IP لمنع الـ spam
    const rl = checkRateLimit(getClientIdentifier(request), {
      id: 'public-complaint',
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.success) {
      return NextResponse.json(
        { error: rl.error || 'بعتّ شكاوى كتير، حاول بعد شوية' },
        { status: 429 }
      );
    }

    const { memberId } = await params;
    const payload = await request.json();

    // 🔒 تأكيد الملكية: لازم صاحب الطلب يعرف رقم هاتف العضو (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, payload?.phoneNumber))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك لتأكيد العملية' }, { status: 401 });
    }

    const body = String(payload?.body || '').trim();
    if (!body) {
      return NextResponse.json({ error: 'اكتب نص الشكوى' }, { status: 400 });
    }
    if (body.length > BODY_MAX) {
      return NextResponse.json({ error: `نص الشكوى طويل (${BODY_MAX} حرف كحد أقصى)` }, { status: 400 });
    }

    const subject = String(payload?.subject || '').trim().slice(0, SUBJECT_MAX) || null;

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, memberNumber: true, phone: true },
    });
    if (!member) {
      return NextResponse.json({ error: 'العضو غير موجود' }, { status: 404 });
    }

    const complaint = await prisma.complaint.create({
      data: {
        memberId: member.id,
        memberName: member.name,
        memberNumber: member.memberNumber || null,
        memberPhone: member.phone || null,
        subject,
        body,
        priority: 'normal',
        status: 'open',
        source: 'app',
      },
      select: { id: true, subject: true, body: true, status: true, createdAt: true },
    });

    return NextResponse.json({ success: true, complaint }, { status: 201 });
  } catch (error) {
    console.error('Create member complaint error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
