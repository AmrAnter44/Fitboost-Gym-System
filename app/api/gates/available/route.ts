// 🚪 البوابات المفعّلة (اسم + id بس) — لأي موظف مسجّل دخول
//  الفورم محتاجها عشان يظهر زرار «صوّر من البوابة». مفيش أي بيانات اتصال هنا.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser, gateErrorResponse } from '@/lib/gates/api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireUser(request)
    const gates = await prisma.gate.findMany({
      where: { isEnabled: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json({ success: true, gates })
  } catch (e) {
    return gateErrorResponse(e)
  }
}
