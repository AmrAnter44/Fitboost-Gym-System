import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 🔒 Rate limit: 10 محاولات / 5 دقايق لكل IP لمنع brute-force
    const clientId = getClientIdentifier(request);
    const rl = checkRateLimit(clientId, {
      id: 'public-verify',
      limit: 10,
      windowMs: 5 * 60 * 1000
    });
    if (!rl.success) {
      return NextResponse.json(
        { success: false, error: rl.error || 'محاولات كثيرة، حاول بعد قليل' },
        { status: 429 }
      );
    }

    const { memberNumber, phoneNumber } = await request.json();

    // Validate input
    if (!memberNumber || !phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'رقم العضوية ورقم الهاتف مطلوبان' },
        { status: 400 }
      );
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-10); // Last 10 digits

    // Find member by memberNumber AND phone
    const member = await prisma.member.findFirst({
      where: {
        memberNumber: parseInt(memberNumber),
        phone: {
          contains: cleanPhone,
        },
      },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        profileImage: true,
        isActive: true,
      },
    });

    if (!member) {
      return NextResponse.json(
        { success: false, error: 'البيانات غير صحيحة' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.name,
        profileImage: member.profileImage,
      },
    });
  } catch (error) {
    console.error('Verify member error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
