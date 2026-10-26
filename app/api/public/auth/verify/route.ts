import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit';
import { phoneTail, samePhone, packageId } from '@/lib/memberVerify';
import { absoluteImageUrl } from '@/lib/publicImageUrl';

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

    // 🎟️ مفيش عضو بالرقم ده؟ نجرّب عملاء الحصص المخصصة (PT) / خدمات المزيد (More).
    // بس لو الأبلكيشن قال إنه بيدعم الوضع ده (allowPackageLogin) — النسخ القديمة
    // من الأبلكيشن لو دخلت بـ id زي "pt_5" هتاخد 401 من /profile وتعمل logout
    // على طول، فالأحسن تفضل تشوف "البيانات غير صحيحة" زي ما كانت.
    if (!member && body?.allowPackageLogin === true) {
      const pkg = await findPackageLogin(String(memberNumber).trim(), phoneNumber, request);
      if (pkg) {
        return NextResponse.json({ success: true, member: pkg });
      }
    }

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
        profileImage: absoluteImageUrl(request, member.profileImage),
        // 📜 null = العضو لسه ماوافقش على الشروط — التطبيق بيعرضها له بعد اللوجن
        termsAcceptedAt: member.termsAcceptedAt,
        kind: 'member',
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

/**
 * 🎟️ لوجن عميل حصص بس: رقم الـ PT (أو More) + تليفون مطابق.
 * - لو فيه عضو (Member) بنفس التليفون → بنرجّع العضو ده (بياخد الأبلكيشن كامل).
 * - غير كده بنرجّع payload بنفس شكل العضو عشان الأبلكيشن مايتلخبطش،
 *   والـ id = "pt_<n>" / "more_<n>" و kind = 'pt' | 'more'.
 * الدخول مش بيتقفل لما الحصص تخلص أو تنتهي — العميل بيشوف السجل + عروض التجديد.
 */
async function findPackageLogin(number: string, phoneNumber: unknown, request: Request) {
  if (!/^\d{1,9}$/.test(number)) return null;
  const n = Number(number);
  if (!Number.isSafeInteger(n) || n <= 0) return null;

  let kind: 'pt' | 'more' | null = null;
  let rec: { phone: string; clientName: string } | null = null;

  const pt = await prisma.pT.findUnique({ where: { ptNumber: n }, select: { phone: true, clientName: true } });
  if (pt && samePhone(pt.phone, phoneNumber)) {
    kind = 'pt';
    rec = pt;
  } else {
    const more = await prisma.more.findUnique({ where: { moreNumber: n }, select: { phone: true, clientName: true } });
    if (more && samePhone(more.phone, phoneNumber)) {
      kind = 'more';
      rec = more;
    }
  }
  if (!kind || !rec) return null;

  // 👤 عنده عضوية بنفس التليفون؟ ندخّله كعضو عادي (الأفضلية للعضو النشط ثم الأحدث)
  const tail = phoneTail(phoneNumber);
  if (tail) {
    const sameMembers = (
      await prisma.member.findMany({
        where: { phone: { contains: tail } },
        select: {
          id: true,
          memberNumber: true,
          name: true,
          profileImage: true,
          isActive: true,
          termsAcceptedAt: true,
          phone: true,
          expiryDate: true,
        },
        take: 10,
      })
    ).filter((m) => samePhone(m.phone, phoneNumber));
    if (sameMembers.length) {
      sameMembers.sort(
        (a, b) =>
          Number(b.isActive) - Number(a.isActive) ||
          (b.expiryDate?.getTime() ?? 0) - (a.expiryDate?.getTime() ?? 0)
      );
      const m = sameMembers[0];
      return {
        id: m.id,
        memberNumber: m.memberNumber,
        name: m.name,
        profileImage: absoluteImageUrl(request, m.profileImage),
        termsAcceptedAt: m.termsAcceptedAt,
        kind: 'member' as const,
      };
    }
  }

  return {
    id: packageId(kind, n),
    memberNumber: String(n),
    name: rec.clientName,
    profileImage: null,
    // مفيش عمود موافقة على الشروط في PT/More — الأبلكيشن بيعرض الشروط ويسجّلها محلياً
    termsAcceptedAt: null,
    kind,
  };
}
