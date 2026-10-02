import { NextResponse } from 'next/server'
import { prisma } from '../../../../lib/prisma'
import { requirePermission } from '../../../../lib/auth'
import { parseEventBody } from '../../../../lib/gymEvents'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requirePermission(request, 'canAccessSettings') } catch (e: any) {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: e?.message === 'Unauthorized' ? 401 : 403 })
  }
  const { id } = await ctx.params
  const p = parseEventBody(await request.json().catch(() => null))
  if ('error' in p) return NextResponse.json({ error: p.error }, { status: 400 })
  const event = await prisma.gymEvent.update({ where: { id }, data: p.data }).catch(() => null)
  if (!event) return NextResponse.json({ error: 'الإيفنت مش موجود' }, { status: 404 })
  return NextResponse.json({ event })
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try { await requirePermission(request, 'canAccessSettings') } catch (e: any) {
    return NextResponse.json({ error: 'ليس لديك صلاحية' }, { status: e?.message === 'Unauthorized' ? 401 : 403 })
  }
  const { id } = await ctx.params
  await prisma.gymEvent.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
