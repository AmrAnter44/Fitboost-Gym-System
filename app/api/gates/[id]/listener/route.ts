// 🔗 ربط الجهاز بالسيستم تلقائي (HTTP Listening) — الأونر بس
//   GET  → إعدادات استقبال الأحداث على الجهاز + آخر سكان وصل للسيستم
//   POST { ipAddress, port } → يظبط الجهاز يبعت الأحداث لعنوان السيستم، وبعدين يختبره
//  المرجع: دليل ISAPI (General Application) — 12.2 «Receive Alarm/Event in Listening Mode»
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, gateErrorResponse } from '@/lib/gates/api'
import { toConnection, type GateRow } from '@/lib/gates/sync'
import { getEventSecret } from '@/lib/gates/secrets'
import { getListeners, configureListener, testListener } from '@/lib/hikvision/client'

export const dynamic = 'force-dynamic'

const eventPath = () => `/api/gates/event/${getEventSecret()}`

//  آخر سكان وصل — أي حدث (حتى المرفوض)، عشان نعرف إن الربط شغّال
async function lastScan() {
  const ev = await prisma.gateEvent.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, eventTime: true, allowed: true, reason: true, memberId: true, employeeNo: true },
  })
  if (!ev) return null
  const m = ev.memberId ? await prisma.member.findUnique({ where: { id: ev.memberId }, select: { name: true, memberNumber: true } }) : null
  return { at: ev.createdAt, eventTime: ev.eventTime, allowed: ev.allowed, reason: ev.reason, employeeNo: ev.employeeNo, member: m }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request)
    const gate = await prisma.gate.findUnique({ where: { id: params.id } })
    if (!gate) return NextResponse.json({ success: false, error: 'البوابة مش موجودة' }, { status: 404 })

    const path = eventPath()
    let device: { linked: boolean; slots: { id: string; ipAddress: string; portNo: number; ours: boolean }[] } | null = null
    let deviceError: string | null = null
    try {
      const { slots } = await getListeners(toConnection(gate as GateRow))
      const list = slots.map(s => ({ id: s.id, ipAddress: s.ipAddress, portNo: s.portNo, ours: s.url === path }))
      device = { linked: list.some(s => s.ours), slots: list }
    } catch (e) {
      deviceError = e instanceof Error ? e.message : String(e)
    }
    return NextResponse.json({ success: true, device, deviceError, lastScan: await lastScan() })
  } catch (e) {
    return gateErrorResponse(e)
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request)
    const gate = await prisma.gate.findUnique({ where: { id: params.id } })
    if (!gate) return NextResponse.json({ success: false, error: 'البوابة مش موجودة' }, { status: 404 })

    const body = await request.json().catch(() => null)
    const ipAddress = String(body?.ipAddress || '').trim()
    const port = Number(body?.port) || 4001
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ipAddress)) {
      return NextResponse.json({ success: false, error: 'اختار عنوان الكمبيوتر على الشبكة' }, { status: 400 })
    }
    if (port < 1 || port > 65535) return NextResponse.json({ success: false, error: 'رقم البورت غلط' }, { status: 400 })

    const conn = toConnection(gate as GateRow)
    const target = { ipAddress, portNo: port, url: eventPath() }
    const { id, replaced } = await configureListener(conn, target)
    //  الاختبار مش شرط للنجاح — بعض الموديلات مابتدعمش /test
    const test = await testListener(conn, id, target).catch(e => ({ ok: false, error: e instanceof Error ? e.message : String(e), unsupported: true }))

    await prisma.gate.update({ where: { id: gate.id }, data: { lastSeenAt: new Date(), lastError: null } })
    return NextResponse.json({
      success: true,
      slotId: id,
      replaced: replaced ? `${replaced.ipAddress}:${replaced.portNo}` : null,
      test,
    })
  } catch (e) {
    return gateErrorResponse(e)
  }
}
