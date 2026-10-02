// 📣 إيفنتات الجيم — للإدارة (صلاحية الإعدادات)
import { NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { requirePermission } from '../../../lib/auth'
import { parseEventBody } from '../../../lib/gymEvents'

export const dynamic = 'force-dynamic'

function deny(e: any) {
  const unauth = e?.message === 'Unauthorized'
  return NextResponse.json({ error: unauth ? 'يجب تسجيل الدخول' : 'ليس لديك صلاحية' }, { status: unauth ? 401 : 403 })
}

export async function GET(request: Request) {
  try { await requirePermission(request, 'canAccessSettings') } catch (e) { return deny(e) }
  const events = await prisma.gymEvent.findMany({ orderBy: { startsAt: 'desc' }, take: 100 })
  const { countMemberDevices } = await import('../../../lib/memberBroadcast')
  const devices = await countMemberDevices().catch(() => 0)
  return NextResponse.json({ events, devices })
}

export async function POST(request: Request) {
  let user
  try { user = await requirePermission(request, 'canAccessSettings') } catch (e) { return deny(e) }
  const p = parseEventBody(await request.json().catch(() => null))
  if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 })
  const event = await prisma.gymEvent.create({ data: { ...p.data, createdBy: user.name || user.email || null } })
  return NextResponse.json({ event }, { status: 201 })
}
