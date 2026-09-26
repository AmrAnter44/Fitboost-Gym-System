import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

// ⛔ معطّل لأسباب أمنية (2026-09):
//    المسار كان مكشوف بالكامل و POST بيمسح كل الحضور الأقدم من ساعتين
//    (deleteMany على MemberCheckIn) — أي حد مجهول كان يقدر يمسح سجل
//    الحضور كله. مفيش أي مستدعي في الكود، فاتعطّل بدل ما يتقفل.
//    لو احتجناه بعدين لازم يرجع بمصادقة أدمن + سبب واضح ليه بيمسح داتا.

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }
  return NextResponse.json(
    { error: 'هذه العملية معطّلة — مسح الحضور التلقائي موقوف' },
    { status: 410 }
  )
}

export async function GET(request: Request) {
  const user = await verifyAuth(request)
  if (!user || (user.role !== 'OWNER' && user.role !== 'ADMIN')) {
    return NextResponse.json({ error: 'غير مصرّح' }, { status: 403 })
  }
  return NextResponse.json({ disabled: true, expiredCount: 0, expiredCheckIns: [] })
}
