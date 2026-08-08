// app/api/members/[id]/photo/route.ts
// بيقدّم صورة العضو المتخزنة base64 جوه عمود profileImage كصورة عادية بكاش —
// عشان قوايم الأعضاء والحضور ترجّع لينك صغير بدل الـ base64 نفسه.
// (الصور الجديدة/المتهاجرة ملفات على الديسك ولينكها بيعدي في القوايم زي ما هو،
//  فالمسار ده بيخدم الداتا القديمة لحد ما المهاجرة تتعمل من الإعدادات.)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

const DATA_URI_RE = /^data:(image\/[a-zA-Z0-9+.\-]+);base64,(.+)$/

const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

function transparentResponse() {
  return new NextResponse(TRANSPARENT_PIXEL, {
    status: 200,
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' },
  })
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      select: { profileImage: true },
    })

    const value = member?.profileImage
    if (!value) return transparentResponse()

    // base64 جوه العمود → فك وتقديم مباشر
    const match = DATA_URI_RE.exec(value)
    if (match) {
      const buffer = Buffer.from(match[2], 'base64')
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': match[1],
          // الصورة بتتغير نادرًا — كاش يوم كامل بيوفر إعادة التحميل مع كل فتح قايمة
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // العمود فيه لينك ملف (بعد المهاجرة) — منع self-redirect ثم تحويل
    if (value.startsWith(`/api/members/`)) return transparentResponse()
    if (value.startsWith('/')) {
      return NextResponse.redirect(new URL(value, request.url), 302)
    }

    return transparentResponse()
  } catch {
    return transparentResponse()
  }
}
