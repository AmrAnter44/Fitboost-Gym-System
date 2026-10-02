// 📍 «حدّد مكان الفرع» — المدير واقف في الجيم: بيتحفظ هنا وبيتبعت لـ Control (مصدر واحد)
import { NextResponse } from 'next/server'
import { prisma } from '../../../../../lib/prisma'
import { verifyAuth } from '../../../../../lib/auth'
import { validCoords, MAX_ACCURACY_M } from '../../../../../lib/smartAttendance'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  if (!['OWNER', 'ADMIN', 'MANAGER'].includes(user.role)) {
    return NextResponse.json({ error: 'للمدير بس' }, { status: 403 })
  }
  const b = await request.json().catch(() => null)
  const lat = Number(b?.lat), lng = Number(b?.lng), accuracy = Number(b?.accuracy)
  if (!validCoords(lat, lng)) return NextResponse.json({ error: 'إحداثيات غير صحيحة' }, { status: 400 })
  if (b?.mocked === true) return NextResponse.json({ error: 'الموقع مش حقيقي' }, { status: 403 })
  if (Number.isFinite(accuracy) && accuracy > MAX_ACCURACY_M) {
    return NextResponse.json({ error: 'إشارة اللوكيشن ضعيفة — جرّب تاني وإنت جوه الجيم' }, { status: 400 })
  }

  // Control الأول (المصدر الأساسي) — لو مفيش نت/مش مربوط بنحفظ محلي برضو ونقول
  let synced = false
  try {
    const { gw } = await import('../../../../../lib/gateway')
    await gw('branch-location', { body: { lat, lng }, timeoutMs: 8000 })
    synced = true
  } catch (e: any) {
    console.error('branch-location sync:', e?.message || e)
  }
  await prisma.systemSettings.update({ where: { id: 'singleton' }, data: { branchLat: lat, branchLng: lng } })
  return NextResponse.json({ ok: true, synced })
}
