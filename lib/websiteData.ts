// lib/websiteData.ts
// تعديل بيانات ويبسايت الجيم (branch_data على Supabase) من جوه السيستم —
// من غير إيميل وباسورد: الهوية هنا هي رخصة النظام (الجيم + الفرع المحفوظين
// في SupabaseLicense). كل العمليات بتتعمل من السيرفر بالـ service role ومقفولة
// على branch_id بتاع الرخصة، فمفيش أي فرع يقدر يلمس بيانات فرع تاني.

import { NextResponse } from 'next/server'
import { requireAdmin, type UserPayload } from './auth'
import { prisma } from './prisma'
import { validateLicense } from './license'

export const WEBSITE_DATA_TYPES = ['coach', 'offer', 'pt_package', 'class', 'membership'] as const
export type WebsiteDataType = (typeof WEBSITE_DATA_TYPES)[number]

export const WEBSITE_MEDIA_BUCKET = 'gym-media'

export interface LicensedBranch {
  user: UserPayload
  gymId: string
  gymName: string
  branchId: string
  branchName: string
}

/**
 * يتأكد إن المستخدم أدمن/أونر وإن السيستم مربوط برخصة فعّالة،
 * وبيرجّع الجيم والفرع اللي هيتعدّل عليهم — أو NextResponse بالخطأ.
 */
export async function resolveLicensedBranch(
  request: Request
): Promise<LicensedBranch | NextResponse> {
  let user: UserPayload
  try {
    user = await requireAdmin(request)
  } catch (e: any) {
    const unauthorized = e?.message === 'Unauthorized'
    return NextResponse.json(
      { error: unauthorized ? 'يجب تسجيل الدخول' : 'الصفحة دي للأدمن بس' },
      { status: unauthorized ? 401 : 403 }
    )
  }

  const license = await prisma.supabaseLicense.findFirst({
    orderBy: { lastChecked: 'desc' },
  })
  if (!license?.gymId || !license?.branchId) {
    return NextResponse.json(
      { error: 'السيستم مش مربوط برخصة. اختار الجيم والفرع من الإعدادات ← الترخيص.', code: 'NO_LICENSE' },
      { status: 400 }
    )
  }

  const status = await validateLicense()
  if (!status.valid) {
    return NextResponse.json(
      { error: status.message || 'الترخيص غير فعّال', code: 'LICENSE_INVALID' },
      { status: 403 }
    )
  }

  return {
    user,
    gymId: license.gymId,
    gymName: license.gymName,
    branchId: license.branchId,
    branchName: license.branchName,
  }
}

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

const toText = (v: unknown, max = 500): string | null => {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s.slice(0, max) : null
}

/**
 * نفس شكل الداتا اللي بيحفظها AddDataModal في Web-Fitboost بالظبط،
 * عشان الويبسايت يعرضها من غير أي تغيير.
 */
export function buildBranchDataPayload(dataType: WebsiteDataType, body: any) {
  const features: string[] = Array.isArray(body?.features)
    ? body.features.map((f: unknown) => String(f).trim()).filter(Boolean).slice(0, 30)
    : []

  const sessions = toNumber(body?.sessions_count)

  return {
    name: toText(body?.name, 200),
    description: toText(body?.description, 1000),
    price: toNumber(body?.price),
    original_price: toNumber(body?.original_price),
    image_url: toText(body?.image_url, 500),
    is_active: true,
    coach_name: dataType === 'class' ? toText(body?.coach_name, 200) : null,
    day_of_week: dataType === 'class' ? toText(body?.day_of_week, 20) : null,
    time: dataType === 'class' ? toText(body?.time, 10) : null,
    class_type: dataType === 'class' ? toText(body?.class_type, 30) : null,
    role: dataType === 'coach' ? toText(body?.role, 200) || 'Coach' : null,
    sessions_count: dataType === 'pt_package' && sessions !== null ? Math.round(sessions) : null,
    metadata:
      (dataType === 'membership' || dataType === 'pt_package') && features.length > 0
        ? { features }
        : null,
  }
}

/** يرجّع رسالة خطأ لو البيانات ناقصة، أو null لو تمام */
export function validateBranchDataPayload(
  dataType: WebsiteDataType,
  p: ReturnType<typeof buildBranchDataPayload>
): string | null {
  if (!p.name) return 'الاسم مطلوب'
  if (dataType === 'pt_package') {
    if (p.sessions_count === null) return 'عدد الجلسات مطلوب'
    if (p.price === null) return 'السعر مطلوب'
  }
  if (dataType === 'membership' && p.price === null) return 'السعر مطلوب'
  if (dataType === 'class') {
    if (!p.day_of_week) return 'اليوم مطلوب'
    if (!p.class_type) return 'نوع الكلاس مطلوب'
  }
  return null
}

export function isWebsiteDataType(v: unknown): v is WebsiteDataType {
  return typeof v === 'string' && (WEBSITE_DATA_TYPES as readonly string[]).includes(v)
}
