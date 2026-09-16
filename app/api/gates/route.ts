// 🚪 قائمة البوابات وإضافة بوابة — الأونر بس
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, gateErrorResponse } from '@/lib/gates/api'
import { encryptPassword, getEventSecret } from '@/lib/gates/secrets'
import { invalidateGatesCache } from '@/lib/gates/sync'

export const dynamic = 'force-dynamic'

/** الباسورد مابيخرجش للواجهة أبداً — بنبعت علامة إنه متسجّل بس. */
const publicFields = {
  id: true, name: true, host: true, port: true, useHttps: true,
  username: true, doorNo: true, planTemplateNo: true, capacity: true,
  isEnabled: true, lastSeenAt: true, lastError: true, createdAt: true,
} as const

export async function GET(request: Request) {
  try {
    await requireOwner(request)
    const gates = await prisma.gate.findMany({
      select: publicFields,
      orderBy: { createdAt: 'asc' },
    })

    //  عدّاد المستخدمين على كل جهاز — بيغذّي تحذير السعة في الواجهة
    const counts = await prisma.gateMemberSync.groupBy({
      by: ['gateId'],
      _count: { _all: true },
    })
    const byGate = new Map(counts.map(c => [c.gateId, c._count._all]))

    return NextResponse.json({
      success: true,
      gates: gates.map(g => ({ ...g, onDevice: byGate.get(g.id) ?? 0 })),
      //  السر ده بيتحط في إعدادات HTTP Listening على الجهاز
      eventSecret: getEventSecret(),
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

export async function POST(request: Request) {
  try {
    await requireOwner(request)
    const body = await request.json()

    const host = String(body.host ?? '').trim()
    const password = String(body.password ?? '')
    const name = String(body.name ?? '').trim()

    if (!host) return NextResponse.json({ success: false, error: 'لازم تكتب IP الجهاز' }, { status: 400 })
    if (!password) return NextResponse.json({ success: false, error: 'لازم تكتب كلمة سر الجهاز' }, { status: 400 })
    if (!name) return NextResponse.json({ success: false, error: 'لازم تكتب اسم للبوابة' }, { status: 400 })

    const gate = await prisma.gate.create({
      data: {
        name,
        host,
        port: Number(body.port) || 80,
        useHttps: !!body.useHttps,
        username: String(body.username ?? 'admin').trim() || 'admin',
        passwordEnc: encryptPassword(password),
        doorNo: Number(body.doorNo) || 1,
        planTemplateNo: String(body.planTemplateNo ?? '1'),
        capacity: Number(body.capacity) || 1500,
        isEnabled: body.isEnabled !== false,
      },
      select: publicFields,
    })

    invalidateGatesCache()
    return NextResponse.json({ success: true, gate: { ...gate, onDevice: 0 } })
  } catch (e) {
    return gateErrorResponse(e)
  }
}
