// lib/gates/sync.ts
//  🚪 مزامنة الأعضاء مع أجهزة البوابات
//
//  ليه مُصالِح (reconciler) مش hooks بس؟ لأن في ~٢٢ مكان في الكود بيعدّلوا
//  الـ Member، وتلاتة منهم مخفيين تمامًا:
//    - `app/api/members/route.ts:120-158` كنس الانتهاء بيحصل جوّه **GET**
//    - `app/api/member-checkin/route.ts:168-174` خصم رصيد الدخول ممكن ينهي الاشتراك
//    - `app/api/receipts/[id]/cancel/route.ts:88,96` إلغاء الإيصال بيرجّع الاشتراك
//  ربط المزامنة بالمسارات بس كان هيفوّتهم. المُصالِح بيقارن الحالة المطلوبة
//  باللي اتبعت فعلاً (GateMemberSync) ويبعت الفرق — فبيمسك أي تغيير مهما كان
//  مصدره، حتى raw SQL. (على داتا حقيقية لقينا ٣٠ عضو isActive=true وتاريخهم
//  عدّى — دول كانوا هيفضلوا مفتوحين على البوابة.)
//
//  سياسة السعة: الوش بيتسجّل على الجهاز نفسه، فمفيش أي فايدة من إنشاء
//  مستخدمين معطّلين لناس مش هيقفوا قدام الجهاز. **المستحقين بس بيتبعتوا**،
//  والمعطّل بيتحوّل enabled=false لو كان متبعت قبل كده (عشان وشه يفضل محفوظ
//  للتجديد).

import { prisma } from '../prisma'
import { deviceValidity } from './eligibility'
import { decryptPassword } from './secrets'
import {
  addUser,
  modifyUser,
  deleteUser,
  HikvisionError,
  type GateConnection,
} from '../hikvision/client'

/** الجهاز بياخد التاريخ بصيغة محلية من غير منطقة زمنية. */
function toDeviceTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

//  الجهاز بيرفض تواريخ بعيدة جدًا — بنستخدم ده للاشتراك المفتوح
const OPEN_ENDED = new Date('2037-12-31T23:59:59')
const BEGIN_FALLBACK = new Date('2020-01-01T00:00:00')

export interface GateRow {
  id: string
  name: string
  host: string
  port: number
  useHttps: boolean
  username: string
  passwordEnc: string
  doorNo: number
  planTemplateNo: string
  capacity: number
}

export function toConnection(g: GateRow): GateConnection {
  return {
    host: g.host,
    port: g.port,
    useHttps: g.useHttps,
    username: g.username,
    password: decryptPassword(g.passwordEnc),
    doorNo: g.doorNo,
    planTemplateNo: g.planTemplateNo,
  }
}

//  الحقول اللي القرار بيتبنى عليها — تُحدَّث لو اتغيّرت القاعدة
const MEMBER_FIELDS = {
  id: true, memberNumber: true, name: true, startDate: true,
  isBanned: true, isActive: true, isFrozen: true,
  expiryDate: true, remainingCheckIns: true,
} as const

type MemberForSync = {
  id: string; memberNumber: string | null; name: string; startDate: Date | null
  isBanned: boolean | null; isActive: boolean | null; isFrozen: boolean | null
  expiryDate: Date | null; remainingCheckIns: number | null
}

export interface SyncOutcome {
  action: 'added' | 'modified' | 'deleted' | 'skipped' | 'failed'
  reason?: string
}

/**
 * يوصّل عضو واحد لجهاز واحد للحالة المطلوبة.
 *
 * `dryRun` بيحسب القرار من غير ما يلمس الجهاز ولا الداتابيز — للاختبار على
 * داتا حقيقية قبل ما نوصّل أي جهاز.
 */
export async function syncMemberToGate(
  gate: GateRow,
  member: MemberForSync,
  opts: { dryRun?: boolean; now?: Date } = {}
): Promise<SyncOutcome> {
  const now = opts.now ?? new Date()

  //  رقم العضوية هو هوية المستخدم على الجهاز — من غيره مفيش ربط ممكن
  if (!member.memberNumber) return { action: 'skipped', reason: 'مفيش رقم عضوية' }

  const existing = await prisma.gateMemberSync.findUnique({
    where: { gateId_memberId: { gateId: gate.id, memberId: member.id } },
  })

  const want = deviceValidity(member, now)

  //  مش مستحق ومش متبعت قبل كده → مانعملش حاجة (توفير سعة الجهاز)
  if (!want.enabled && !existing) {
    return { action: 'skipped', reason: 'مش مستحق ومش متبعت قبل كده' }
  }

  //  الحالة زي ما هي؟ مانتعبش الجهاز
  if (
    existing &&
    existing.isAllowed === want.enabled &&
    (existing.validUntil?.getTime() ?? null) === (want.endTime?.getTime() ?? null) &&
    !existing.lastError
  ) {
    return { action: 'skipped', reason: 'متزامن بالفعل' }
  }

  if (opts.dryRun) {
    return { action: existing ? 'modified' : 'added', reason: want.enabled ? 'مفعّل' : 'معطّل' }
  }

  const payload = {
    employeeNo: member.memberNumber,
    name: member.name,
    beginTime: toDeviceTime(member.startDate ?? BEGIN_FALLBACK),
    endTime: toDeviceTime(want.endTime ?? OPEN_ENDED),
    enabled: want.enabled,
  }

  const conn = toConnection(gate)
  let action: SyncOutcome['action'] = existing ? 'modified' : 'added'

  try {
    if (existing) {
      await modifyUser(conn, payload)
    } else {
      try {
        await addUser(conn, payload)
      } catch (e) {
        //  الريسبشن ممكن يكون سجّل وش العضو على الجهاز قبل ما السيستم يبعته،
        //  فالمستخدم موجود أصلاً. ده مسار عادي مش خطأ.
        const already = e instanceof HikvisionError && /exist/i.test(e.body ?? e.message)
        if (!already) throw e
        await modifyUser(conn, payload)
        action = 'modified'
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    await prisma.gateMemberSync.upsert({
      where: { gateId_memberId: { gateId: gate.id, memberId: member.id } },
      create: {
        gateId: gate.id, memberId: member.id, employeeNo: member.memberNumber,
        isAllowed: false, validUntil: want.endTime, lastError: msg,
      },
      update: { lastError: msg, syncedAt: new Date() },
    })
    return { action: 'failed', reason: msg }
  }

  await prisma.gateMemberSync.upsert({
    where: { gateId_memberId: { gateId: gate.id, memberId: member.id } },
    create: {
      gateId: gate.id, memberId: member.id, employeeNo: member.memberNumber,
      isAllowed: want.enabled, validUntil: want.endTime, lastError: null,
    },
    update: {
      employeeNo: member.memberNumber, isAllowed: want.enabled,
      validUntil: want.endTime, lastError: null, syncedAt: new Date(),
    },
  })

  return { action }
}

/** بيشيل العضو من الجهاز نهائيًا (زرار "امسح الوش" في صفحة العضو). */
export async function removeMemberFromGates(
  memberId: string
): Promise<{ removed: number; errors: string[] }> {
  const rows = await prisma.gateMemberSync.findMany({ where: { memberId } })
  const errors: string[] = []
  let removed = 0

  for (const row of rows) {
    const gate = await prisma.gate.findUnique({ where: { id: row.gateId } })
    if (!gate) continue
    try {
      await deleteUser(toConnection(gate as GateRow), row.employeeNo)
      await prisma.gateMemberSync.delete({ where: { id: row.id } })
      removed++
    } catch (e) {
      errors.push(`${gate.name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return { removed, errors }
}

//  الميزة دي مقفولة عند أغلب الجيمات. من غير الكاش ده هنعمل استعلام على
//  جدول Gate مع كل تعديل على أي عضو — على الفاضي.
let gatesPresent: { value: boolean; at: number } | null = null
const GATES_CACHE_MS = 60_000

export function invalidateGatesCache(): void {
  gatesPresent = null
}

async function anyGatesEnabled(): Promise<boolean> {
  const now = Date.now()
  if (gatesPresent && now - gatesPresent.at < GATES_CACHE_MS) return gatesPresent.value
  const count = await prisma.gate.count({ where: { isEnabled: true } })
  gatesPresent = { value: count > 0, at: now }
  return gatesPresent.value
}

/** مزامنة عضو واحد على كل الأجهزة المفعّلة. بتتنادى بعد إنشاء/تجديد/تجميد. */
export async function syncMember(memberId: string): Promise<void> {
  if (!(await anyGatesEnabled())) return

  const [gates, member] = await Promise.all([
    prisma.gate.findMany({ where: { isEnabled: true } }),
    prisma.member.findUnique({ where: { id: memberId }, select: MEMBER_FIELDS }),
  ])
  if (!member || gates.length === 0) return
  for (const gate of gates) {
    await syncMemberToGate(gate as GateRow, member as MemberForSync)
  }
}

/**
 * نسخة لا تفشل أبدًا — للنداء من مسارات الأعضاء.
 * البوابة ماتوقّعش عملية تجديد؛ المُصالِح هيصلّح أي فشل بعد شوية.
 */
export function syncMemberInBackground(memberId: string): void {
  syncMember(memberId).catch(err => {
    console.error('[gates] فشلت مزامنة العضو', memberId, err?.message ?? err)
  })
}

export interface ReconcileReport {
  gateId: string
  gateName: string
  added: number
  modified: number
  deleted: number
  skipped: number
  failed: number
  onDevice: number
  capacity: number
  errors: string[]
}

/**
 * المُصالِح: يمشي على كل الأعضاء ويوصّل الجهاز للحالة الصح.
 *
 * بيشتغل دوريًا من `instrumentation.ts`. الترتيب مهم: المستحقين الأول عشان
 * لو السعة ضاقت يبقى اللي اتبعت هو المهم.
 */
export async function reconcileAll(
  opts: { dryRun?: boolean; now?: Date } = {}
): Promise<ReconcileReport[]> {
  const now = opts.now ?? new Date()
  const gates = await prisma.gate.findMany({ where: { isEnabled: true } })
  if (gates.length === 0) return []

  const members = (await prisma.member.findMany({
    where: { memberNumber: { not: null } },
    select: MEMBER_FIELDS,
  })) as MemberForSync[]

  //  المستحقين الأول
  const ordered = [...members].sort((a, b) => {
    const ea = deviceValidity(a, now).enabled ? 0 : 1
    const eb = deviceValidity(b, now).enabled ? 0 : 1
    if (ea !== eb) return ea - eb
    return (b.expiryDate?.getTime() ?? 0) - (a.expiryDate?.getTime() ?? 0)
  })

  const reports: ReconcileReport[] = []

  for (const gate of gates) {
    const r: ReconcileReport = {
      gateId: gate.id, gateName: gate.name,
      added: 0, modified: 0, deleted: 0, skipped: 0, failed: 0,
      onDevice: 0, capacity: gate.capacity, errors: [],
    }

    for (const m of ordered) {
      const out = await syncMemberToGate(gate as GateRow, m, opts)
      if (out.action === 'added') r.added++
      else if (out.action === 'modified') r.modified++
      else if (out.action === 'failed') {
        r.failed++
        if (r.errors.length < 5) r.errors.push(`${m.memberNumber}: ${out.reason}`)
      } else r.skipped++
    }

    r.onDevice = await prisma.gateMemberSync.count({ where: { gateId: gate.id } })

    //  حارس السعة: فوق ٩٠٪ بنفضّي مكان بأقدم المعطّلين.
    //  العضو المستحق مابيتشالش أبدًا مهما حصل.
    const limit = Math.floor(gate.capacity * 0.9)
    if (!opts.dryRun && r.onDevice > limit) {
      const victims = await prisma.gateMemberSync.findMany({
        where: { gateId: gate.id, isAllowed: false },
        orderBy: [{ validUntil: 'asc' }, { syncedAt: 'asc' }],
        take: r.onDevice - limit,
      })
      for (const v of victims) {
        try {
          await deleteUser(toConnection(gate as GateRow), v.employeeNo)
          await prisma.gateMemberSync.delete({ where: { id: v.id } })
          r.deleted++
        } catch (e) {
          if (r.errors.length < 5) r.errors.push(`مسح ${v.employeeNo}: ${e instanceof Error ? e.message : e}`)
        }
      }
      r.onDevice -= r.deleted
    }

    reports.push(r)
  }

  return reports
}
