import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * 🔒 تعديل صورة العضو من الأبليكشن **مقفول** — الصورة تتغيّر من السيستم فقط.
 * بنرجّع 403 لأي محاولة تعديل بدل ما نطبّقها، عشان الإغلاق يسري مهما كانت
 * نسخة الأبليكشن المتسطبة عند العضو (الإنفورس على السيرفر مش على الواجهة).
 */
export async function PUT(
  _request: NextRequest,
  _ctx: { params: Promise<{ memberId: string }> }
) {
  return NextResponse.json(
    { error: 'تعديل الصورة متاح من السيستم فقط — برجاء التواصل مع الإدارة' },
    { status: 403 }
  )
}
