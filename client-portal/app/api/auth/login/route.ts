import { NextRequest, NextResponse } from 'next/server';
import { generateMemberToken, getClientIp } from '@/lib/auth';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { sanitizePhone } from '@/lib/utils';
import { verifyMemberCredentials } from '@/lib/api-client';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting: 5 attempts per 15 minutes per IP
    const clientIp = getClientIp(request);
    const rateLimitResult = await checkRateLimit(clientIp, 5, 15 * 60);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: 'محاولات كثيرة. حاول مرة أخرى بعد قليل',
          resetIn: rateLimitResult.resetIn,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { memberNumber, phoneNumber } = body;

    // Validate input
    if (!memberNumber || !phoneNumber) {
      return NextResponse.json(
        { error: 'رقم العضوية ورقم الهاتف مطلوبان' },
        { status: 400 }
      );
    }

    // Sanitize phone number
    const cleanPhone = sanitizePhone(phoneNumber);

    // Verify credentials via main system API
    const result = await verifyMemberCredentials(
      parseInt(memberNumber),
      cleanPhone
    );

    if (!result.success || !result.member) {
      return NextResponse.json(
        { error: result.error || 'البيانات غير صحيحة' },
        { status: 401 }
      );
    }

    const member = result.member;

    // Generate JWT token (7 days expiry)
    const token = generateMemberToken({
      memberId: member.id,
      memberNumber: member.memberNumber,
      name: member.name,
    });

    // Reset rate limit on successful login
    resetRateLimit(clientIp);

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      member: {
        id: member.id,
        memberNumber: member.memberNumber,
        name: member.name,
        profileImage: member.profileImage,
      },
    });

    response.cookies.set('member-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ. حاول مرة أخرى' },
      { status: 500 }
    );
  }
}
