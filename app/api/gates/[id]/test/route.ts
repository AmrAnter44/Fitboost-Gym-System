// 🚪 اختبار الاتصال بالجهاز — الأونر بس
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOwner, gateErrorResponse } from '@/lib/gates/api'
import { toConnection, type GateRow } from '@/lib/gates/sync'
import { ping } from '@/lib/hikvision/client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await requireOwner(request)

    const gate = await prisma.gate.findUnique({ where: { id: params.id } })
    if (!gate) return NextResponse.json({ success: false, error: 'البوابة مش موجودة' }, { status: 404 })

    try {
      const info = await ping(toConnection(gate as GateRow))
      await prisma.gate.update({
        where: { id: gate.id },
        data: { lastSeenAt: new Date(), lastError: null },
      })
      return NextResponse.json({ success: true, ...info })
    } catch (e) {
      //  بنسجّل الفشل على البوابة عشان يبان في القايمة من غير ما تعيد الاختبار
      await prisma.gate.update({
        where: { id: gate.id },
        data: { lastError: e instanceof Error ? e.message : String(e) },
      })
      throw e
    }
  } catch (e) {
    return gateErrorResponse(e)
  }
}
