// 📍 الحضور الذكي من أبلكيشن FB Team — الموظف بيسجّل لنفسه بس (من حسابه)
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { prisma } from '../../../../lib/prisma'
import { verifyAuth } from '../../../../lib/auth'
import { distanceM, getOpenRecord, getSmartSettings, toggleAttendance, validCoords, MAX_ACCURACY_M } from '../../../../lib/smartAttendance'
import { getStaffCheckinUploadsDir, STAFF_CHECKIN_UPLOADS_URL_PREFIX } from '../../../../lib/uploadsPath'

export const dynamic = 'force-dynamic'

const isApp = (req: Request) => /FBTeam\//.test(req.headers.get('user-agent') || '')

async function saveSelfie(attendanceId: string, staffId: string, image: string) {
  const m = image.match(/^data:(image\/(jpeg|jpg|png|webp));base64,(.+)$/)
  if (!m) return
  const buf = Buffer.from(m[3], 'base64')
  if (buf.length < 1024 || buf.length > 2 * 1024 * 1024) return
  const ext = m[1] === 'image/png' ? '.png' : m[1] === 'image/webp' ? '.webp' : '.jpg'
  const dir = getStaffCheckinUploadsDir()
  await mkdir(dir, { recursive: true })
  const filename = `${staffId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`
  const filepath = path.join(dir, filename)
  await writeFile(filepath, buf)
  const url = process.env.UPLOADS_PATH !== undefined
    ? `/api/serve-image?path=${encodeURIComponent(filepath)}`
    : `${STAFF_CHECKIN_UPLOADS_URL_PREFIX}${filename}`
  await prisma.attendance.update({ where: { id: attendanceId }, data: { selfieImage: url } })
}

export async function POST(request: Request) {
  const user = await verifyAuth(request)
  if (!user) return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 })
  if (!user.staffId) return NextResponse.json({ error: 'حسابك مش مربوط بموظف — كلّم المدير' }, { status: 400 })

  const s = await getSmartSettings()
  if (!s.enabled) return NextResponse.json({ error: 'الحضور الذكي مقفول في الفرع ده' }, { status: 403 })
  if (s.lat == null || s.lng == null) {
    return NextResponse.json({ error: 'مكان الفرع لسه متحددش — المدير يضغط «حدّد مكان الفرع»' }, { status: 409 })
  }
  if (!isApp(request)) {
    return NextResponse.json({ error: 'الحضور الذكي من أبلكيشن FB Team بس' }, { status: 403 })
  }

  const b = await request.json().catch(() => null)
  const lat = Number(b?.lat), lng = Number(b?.lng), accuracy = Number(b?.accuracy)
  if (!validCoords(lat, lng)) return NextResponse.json({ error: 'مش قادر أحدد مكانك — شغّل اللوكيشن' }, { status: 400 })
  if (b?.mocked !== false) {
    return NextResponse.json({ error: 'الموقع مش حقيقي (برنامج تغيير لوكيشن) — اقفله وجرّب تاني' }, { status: 403 })
  }
  if (!Number.isFinite(accuracy) || accuracy > MAX_ACCURACY_M) {
    return NextResponse.json({ error: 'إشارة اللوكيشن ضعيفة — اقرب من شباك أو استنى ثواني وجرّب تاني' }, { status: 400 })
  }

  const dist = distanceM(lat, lng, s.lat, s.lng)
  // سماحة بسيطة على قد دقة الـ GPS (بحد أقصى 50م)
  if (dist > s.radiusM + Math.min(accuracy, 50)) {
    return NextResponse.json({ error: `إنت بعيد عن الفرع (${dist} م) — لازم تكون جوه ${s.radiusM} م`, distance: dist }, { status: 403 })
  }

  // السيلفي مطلوب مع الحضور بس (لو الإعداد مفعّل) — بنعرف هل هو حضور ولا انصراف قبل التسجيل
  const staff = await prisma.staff.findUnique({ where: { id: user.staffId }, select: { workingHours: true } })
  const willCheckIn = !(await getOpenRecord(user.staffId, staff?.workingHours))
  const selfie = typeof b?.selfie === 'string' ? b.selfie : ''
  if (willCheckIn && s.requireSelfie && !selfie) {
    return NextResponse.json({ error: 'سيلفي مطلوب مع الحضور', needSelfie: true }, { status: 400 })
  }

  const r = await toggleAttendance(user.staffId, `📱 حضور ذكي (${dist} م)`)
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  if (r.action === 'check-in' && r.attendanceId && selfie) {
    await saveSelfie(r.attendanceId, user.staffId, selfie).catch(e => console.error('smart selfie:', e?.message))
  }
  return NextResponse.json({ ok: true, action: r.action, distance: dist, durationMinutes: r.durationMinutes ?? null })
}
