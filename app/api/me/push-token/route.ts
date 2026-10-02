// 📱 تسجيل توكن إشعارات FB Team للموظف المسجّل دخول
import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  const b = await request.json().catch(() => null)
  const token = typeof b?.token === 'string' ? b.token.trim() : ''
  if (!/^ExponentPushToken\[[A-Za-z0-9_-]{10,}\]$/.test(token)) {
    return NextResponse.json({ error: 'توكن غير صحيح' }, { status: 400 })
  }
  // origin = لينك السيستم زي ما الموظف فاتحه (عشان الإشعار يفتح الفرع الصح)
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const proto = request.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto.split(',')[0]}://${host.split(',')[0]}`
  // نفس الموبايل ممكن يتنقل لحساب تاني → التوكن بيتنقل معاه
  await prisma.staffPushToken.upsert({
    where: { token },
    create: { userId: user.userId, token, origin },
    update: { userId: user.userId, origin },
  })
  return NextResponse.json({ ok: true })
}
