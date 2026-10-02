// 📣 ابعت إشعار الإيفنت لكل أعضاء الفرع اللي عندهم الأبلكيشن
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { requirePermission } from '../../../../../lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requirePermission(request, 'canAccessSettings') } catch (e: any) {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: e?.message === 'Unauthorized' ? 401 : 403 })
  }
  const { id } = await ctx.params
  const ev = await prisma.gymEvent.findUnique({ where: { id } })
  if (!ev) return NextResponse.json({ error: 'الإيفنت مش موجود' }, { status: 404 })
  if (!ev.isActive) return NextResponse.json({ error: 'الإيفنت متوقف' }, { status: 400 })

  // قفل بسيط ضد الضغط مرتين: آخر إرسال من أقل من دقيقتين
  if (ev.notifiedAt && Date.now() - ev.notifiedAt.getTime() < 2 * 60_000) {
    return NextResponse.json({ error: 'الإشعار لسه متبعت من شوية' }, { status: 429 })
  }
  await prisma.gymEvent.update({ where: { id }, data: { notifiedAt: new Date() } })

  const when = ev.startsAt.toLocaleString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
  const { broadcastToMembers } = await import('../../../../../lib/memberBroadcast')
  const r = await broadcastToMembers({
    title: `📣 ${ev.title}`,
    body: [when, ev.description].filter(Boolean).join('\n').slice(0, 220),
    data: { type: 'event', eventId: ev.id },
  })
  await prisma.gymEvent.update({ where: { id }, data: { notifiedCount: r.sent } })
  return NextResponse.json({ ok: true, ...r })
}
