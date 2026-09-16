// 🚪 فتح / قفل الباب يدوياً
//
//  متاح لأي مستخدم مسجّل دخول مش للأونر بس: الريسبشن محتاج يفتح لعضو
//  وشه مش متسجّل، أو لو الجهاز رفض حد بالغلط. من غير كده الجيم بيقف
//  لحد ما الأونر ييجي.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, gateErrorResponse } from '@/lib/gates/api'
import { toConnection, type GateRow } from '@/lib/gates/sync'
import { openDoor, closeDoor } from '@/lib/hikvision/client'
import { createAuditLog } from '@/lib/auditLog'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request)
    const { action } = await request.json().catch(() => ({ action: 'open' }))

    if (action !== 'open' && action !== 'close') {
      return NextResponse.json({ success: false, error: 'الأمر لازم يكون open أو close' }, { status: 400 })
    }

    const gate = await prisma.gate.findUnique({ where: { id: params.id } })
    if (!gate) return NextResponse.json({ success: false, error: 'البوابة مش موجودة' }, { status: 404 })

    const conn = toConnection(gate as GateRow)
    if (action === 'open') await openDoor(conn)
    else await closeDoor(conn)

    await prisma.gate.update({ where: { id: gate.id }, data: { lastSeenAt: new Date(), lastError: null } })

    //  فتح باب يدوي لازم يفضل متسجّل — مين فتح وإمتى
    try {
      await createAuditLog({
        userId: user.userId,
        userEmail: user.email,
        userRole: user.role,
        action: 'UPDATE',
        resource: 'Gate',
        resourceId: gate.id,
        details: { command: action, gateName: gate.name },
        status: 'success',
      })
    } catch { /* التسجيل مايفشّلش العملية */ }

    return NextResponse.json({ success: true })
  } catch (e) {
    return gateErrorResponse(e)
  }
}
