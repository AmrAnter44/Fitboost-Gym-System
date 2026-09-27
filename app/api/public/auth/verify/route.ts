import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { phoneTail, samePhone } from '@/lib/memberVerify';

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

    const body = await request.json().catch(() => ({}));
    const memberNumber = body?.memberNumber;
    const phoneNumber = body?.phoneNumber;

    // Validate input — رقم تليفون كامل (10 أرقام على الأقل) مطلوب
    if (!memberNumber || !phoneTail(phoneNumber)) {
      return NextResponse.json(
        { success: false, error: 'رقم العضوية ورقم الهاتف مطلوبان' },
        { status: 400 }
      );
    }

    // 🔒 حد كمان على رقم العضوية نفسه (ضد تخمين التليفون من أكتر من IP)
    const perMember = checkRateLimit(`member:${String(memberNumber).trim()}`, {
      id: 'public-verify-member',
      limit: 10,
      windowMs: 15 * 60 * 1000
    });
    if (!perMember.success) {
      return NextResponse.json(
        { success: false, error: 'محاولات كثيرة، حاول بعد قليل' },
        { status: 429 }
      );
    }

    // مطابقة كاملة للتليفون (آخر 10 أرقام) — مش "contains"
    const candidate = await prisma.member.findFirst({
      where: { memberNumber: String(memberNumber).trim() },
      select: {
        id: true,
        memberNumber: true,
        name: true,
        profileImage: true,
        isActive: true,
        termsAcceptedAt: true,
        phone: true,
      },
    });
    const member = candidate && samePhone(candidate.phone, phoneNumber) ? candidate : null;

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
        // 📜 null = العضو لسه ماوافقش على الشروط — التطبيق بيعرضها له بعد اللوجن
        termsAcceptedAt: member.termsAcceptedAt,
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
