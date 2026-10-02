/**
 * 📍 الحضور الذكي (FB Team)
 *
 * الموظف بيسجّل حضوره/انصرافه من موبايله (أبلكيشن FB Team) وهو جوه نطاق الفرع.
 * - المسافة بتتحسب هنا على السيرفر (مش بنثق في الموبايل).
 * - الموقع المزيّف (Fake GPS) أو الدقة الضعيفة بيترفضوا.
 * - السيلفي حسب إعداد requireSelfieOnCheckIn الموجود.
 * - مكان الفرع مصدره Control (branch_locations) — بيوصل مع فحص الرخصة.
 * الطريقة القديمة (POST /api/attendance بالكود) زي ما هي من غير أي تغيير.
 */
import { prisma } from './prisma'

export const MAX_ACCURACY_M = 100

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

export function validCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
  )
}

export async function getSmartSettings() {
  const s = await prisma.systemSettings.findUnique({
    where: { id: 'singleton' },
    select: {
      smartAttendanceEnabled: true,
      smartAttendanceRadiusM: true,
      branchLat: true,
      branchLng: true,
      requireSelfieOnCheckIn: true,
    },
  })
  return {
    enabled: !!s?.smartAttendanceEnabled,
    radiusM: s?.smartAttendanceRadiusM || 150,
    lat: s?.branchLat ?? null,
    lng: s?.branchLng ?? null,
    requireSelfie: !!s?.requireSelfieOnCheckIn,
  }
}

/** بيتنده من فحص الرخصة لما Control يبعت مكان الفرع */
export async function applyRemoteBranchLocation(loc: { lat?: unknown; lng?: unknown; attendanceRadiusM?: unknown }) {
  if (!validCoords(loc?.lat, loc?.lng)) return
  const r = Number(loc.attendanceRadiusM)
  await prisma.systemSettings.update({
    where: { id: 'singleton' },
    data: {
      branchLat: loc.lat as number,
      branchLng: loc.lng as number,
      ...(Number.isFinite(r) && r >= 30 && r <= 1000 ? { smartAttendanceRadiusM: Math.round(r) } : {}),
    },
  })
}

export function openWindowHours(workingHours?: number | null) {
  const base = workingHours && workingHours > 0 ? workingHours : 8
  return { base, window: Math.max(base + 4, 12) }
}

/** السجل المفتوح الحالي للموظف (بنفس منطق الطريقة القديمة) — من غير ما يعدّل حاجة */
export async function getOpenRecord(staffId: string, workingHours?: number | null) {
  const { window } = openWindowHours(workingHours)
  const since = new Date(Date.now() - window * 3600_000)
  return prisma.attendance.findFirst({
    where: { staffId, checkOut: null, checkIn: { gte: since } },
    orderBy: { checkIn: 'desc' },
  })
}

type ToggleResult = {
  ok: boolean
  action?: 'check-in' | 'check-out'
  attendanceId?: string
  durationMinutes?: number
  error?: string
  status?: number
}

/** حضور ↔ انصراف — نفس قواعد POST /api/attendance (window ديناميكي، قفل تلقائي، دقيقة أمان) */
export async function toggleAttendance(staffId: string, note: string): Promise<ToggleResult> {
  const staff = await prisma.staff.findUnique({ where: { id: staffId } })
  if (!staff) return { ok: false, error: 'الموظف غير موجود', status: 404 }
  if (!staff.isActive) return { ok: false, error: 'حسابك كموظف غير نشط', status: 400 }

  const now = new Date()
  const { base, window } = openWindowHours(staff.workingHours)
  const open = await prisma.attendance.findMany({
    where: { staffId, checkOut: null },
    orderBy: { checkIn: 'desc' },
  })
  for (const r of open) {
    const hrs = (now.getTime() - r.checkIn.getTime()) / 3600_000
    if (hrs > window) {
      const mins = Math.round(base * 60)
      await prisma.attendance.update({
        where: { id: r.id },
        data: {
          checkOut: new Date(r.checkIn.getTime() + mins * 60_000),
          duration: mins,
          notes: [r.notes, 'انصراف تلقائي — الموظف نسي تسجيل الانصراف'].filter(Boolean).join(' | '),
        },
      })
    }
  }
  const active = open.find(r => (now.getTime() - r.checkIn.getTime()) / 3600_000 <= window) || null

  if (active) {
    const mins = (now.getTime() - active.checkIn.getTime()) / 60_000
    if (mins < 1) return { ok: false, error: 'استنى دقيقة قبل تسجيل الانصراف', status: 400 }
    const duration = Math.round(mins)
    await prisma.attendance.update({
      where: { id: active.id },
      data: { checkOut: now, duration, notes: [active.notes, note].filter(Boolean).join(' | ') },
    })
    return { ok: true, action: 'check-out', attendanceId: active.id, durationMinutes: duration }
  }

  const lastOut = await prisma.attendance.findFirst({
    where: { staffId, checkOut: { not: null } },
    orderBy: { checkOut: 'desc' },
  })
  if (lastOut?.checkOut && (now.getTime() - lastOut.checkOut.getTime()) / 60_000 < 1) {
    return { ok: false, error: 'استنى دقيقة قبل تسجيل حضور جديد', status: 400 }
  }
  const created = await prisma.attendance.create({ data: { staffId, checkIn: now, notes: note } })
  return { ok: true, action: 'check-in', attendanceId: created.id }
}
