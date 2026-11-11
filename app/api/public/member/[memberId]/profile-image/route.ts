import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { apiCache } from '@/lib/cache'
import { checkRateLimit, getClientIdentifier } from '@/lib/rateLimit'
import { verifyMemberPhone, memberPhoneFrom } from '@/lib/memberVerify'
import { isPhotoUploadOpen, setPhotoUploadUntil, saveMemberImageFromBase64 } from '@/lib/memberPhotoUpload'

export const dynamic = 'force-dynamic'

/**
 * 🔒 تعديل صورة العضو من الأبليكشن **مقفول** — الصورة تتغيّر من السيستم.
 * 📷 استثناء: الريسيبشن يفتح «سماح» من بروفايل العضو (10 دقايق) → العضو يرفع صورة **مرة واحدة**
 *    وبعدها السماح يتقفل تلقائي. (الإنفورس على السيرفر مش على الواجهة.)
 *
 * body: { imageBase64: "data:image/jpeg;base64,..." , phoneNumber? }  (أو header x-member-phone)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  const rl = checkRateLimit(getClientIdentifier(request), { id: 'profile-image', limit: 10, windowMs: 60_000 })
  if (!rl.success) {
    return NextResponse.json({ error: 'طلبات كثيرة جداً، حاول بعد قليل' }, { status: 429 })
  }

  try {
    const { memberId } = await params
    const body = await request.json().catch(() => ({}))

    // 🔒 تأكيد الملكية برقم الهاتف (ضد الـ IDOR)
    if (!(await verifyMemberPhone(memberId, memberPhoneFrom(request, body?.phoneNumber)))) {
      return NextResponse.json({ error: 'يجب إدخال رقم هاتفك' }, { status: 401 })
    }

    if (!(await isPhotoUploadOpen(prisma, memberId))) {
      return NextResponse.json(
        { error: 'تعديل الصورة متاح من السيستم فقط — اطلب من الريسيبشن يسمحلك ترفع صورتك', locked: true },
        { status: 403 }
      )
    }

    if (!body?.imageBase64 || typeof body.imageBase64 !== 'string') {
      return NextResponse.json({ error: 'الصورة مطلوبة' }, { status: 400 })
    }

    let imageUrl: string
    try {
      imageUrl = await saveMemberImageFromBase64(body.imageBase64)
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'الصورة مش مقبولة' }, { status: 400 })
    }

    //  مرة واحدة: نقفل السماح مع الحفظ
    await prisma.member.update({ where: { id: memberId }, data: { profileImage: imageUrl } })
    await setPhotoUploadUntil(prisma, memberId, null)
    apiCache.delete(`profile:${memberId}`)

    return NextResponse.json({ success: true, profileImage: imageUrl })
  } catch (error) {
    console.error('Update profile image (app) error:', error)
    return NextResponse.json({ error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
