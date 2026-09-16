/**
 * قاعدة "هل العضو مسموح له يدخل؟" — مصدر واحد للبوابة والسكان اليدوي.
 *
 * ⚠️ لازم تفضل متطابقة مع `app/api/member-checkin/route.ts:43-89`. لو
 * اختلفت، هتحصل حالة إن الريسبشن يسكن العضو يدوي والبوابة ترفضه (أو العكس)
 * — وده أسوأ من إن الميزة ماتكونش موجودة أصلاً.
 *
 * مصيدة مهمة: **التجميد بيمدّ `expiryDate` للمستقبل**
 * (`app/api/members/freeze/route.ts:76-78`)، فالعضو المجمّد تاريخه سليم
 * لكن لازم يترفض. عشان كده `isFrozen` بيتفحص قبل التاريخ.
 */

export type DenyReason =
  | 'banned'
  | 'inactive'
  | 'frozen'
  | 'expired'
  | 'noCheckInsLeft'
  | 'outOfAllowedHours'

/** الحد الأدنى من حقول العضو اللي القاعدة محتاجاه. */
export interface EligibilityInput {
  isBanned?: boolean | null
  isActive?: boolean | null
  isFrozen?: boolean | null
  expiryDate?: Date | string | null
  remainingCheckIns?: number | null
  allowedCheckInStart?: string | null
  allowedCheckInEnd?: string | null
}

/**
 * ملحوظة: `reason` اختياري بدل نوع مميّز (discriminated union) لأن المشروع
 * شغّال بـ `strict: false` في tsconfig — ومن غير `strictNullChecks` الـ
 * TypeScript مابيضيّقش الأنواع المميّزة، فـ `if (!r.allowed) r.reason`
 * كانت بتطلع خطأ. الشكل ده أبسط وبيشتغل مع إعدادات المشروع زي ما هي.
 */
export interface Eligibility {
  allowed: boolean
  /** موجود لما `allowed` تكون false */
  reason?: DenyReason
}

const REASON_AR: Record<DenyReason, string> = {
  banned: 'العضو محظور 🚫',
  inactive: 'اشتراك العضو منتهي',
  frozen: 'الاشتراك مجمد حالياً ❄️',
  expired: 'انتهت مدة الاشتراك 🚫',
  noCheckInsLeft: 'انتهى عدد حصص الدخول في الباقة 🚫',
  outOfAllowedHours: 'خارج ساعات الدخول المسموحة 🕐',
}

export const denyReasonText = (r: DenyReason) => REASON_AR[r]

const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/
const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * القرار الكامل. `now` قابل للحقن عشان الاختبار.
 *
 * ملحوظة: ساعات الدخول بتتقارن بتوقيت السيرفر المحلي — نفس ما بيعمل
 * `member-checkin`. الجهاز والسيرفر في نفس المكان فمفيش فرق مناطق زمنية.
 */
export function evaluateEligibility(m: EligibilityInput, now: Date = new Date()): Eligibility {
  if (m.isBanned) return { allowed: false, reason: 'banned' }
  if (!m.isActive) return { allowed: false, reason: 'inactive' }
  if (m.isFrozen) return { allowed: false, reason: 'frozen' }

  if (m.expiryDate) {
    const exp = new Date(m.expiryDate)
    if (!isNaN(exp.getTime()) && exp < now) return { allowed: false, reason: 'expired' }
  }

  // null/undefined = دخول غير محدود
  if (m.remainingCheckIns !== null && m.remainingCheckIns !== undefined && m.remainingCheckIns <= 0) {
    return { allowed: false, reason: 'noCheckInsLeft' }
  }

  // بيتفعّل بس لما الاتنين موجودين وبصيغة صحيحة — زي member-checkin بالظبط
  const { allowedCheckInStart: s, allowedCheckInEnd: e } = m
  if (s && e && HHMM.test(s) && HHMM.test(e)) {
    const cur = now.getHours() * 60 + now.getMinutes()
    const start = toMinutes(s)
    const end = toMinutes(e)
    // نافذة بتعدّي منتصف الليل (مثلاً 22:00 → 06:00)
    const inside = start <= end ? cur >= start && cur <= end : cur >= start || cur <= end
    if (!inside) return { allowed: false, reason: 'outOfAllowedHours' }
  }

  return { allowed: true }
}

/**
 * الصلاحية اللي هتتبعت للجهاز.
 *
 * الجهاز بيعرف يتحقق من **مدى زمني** بس — مابيعرفش حاجة عن التجميد ولا
 * الحظر ولا رصيد الدخلات. فأي سبب رفض غير انتهاء المدة بيتحوّل لـ
 * `enabled: false`، والجهاز يرفضه من غير ما يفهم السبب.
 *
 * ساعات الدخول مش داخلة في القرار ده: هي بتتغيّر كل ساعة، ومش هنعيد
 * مزامنة الجهاز كل ساعة. الجهاز هيسمح والسيستم هيسجّل الحدث ويسيب
 * التقرير يوضّح. (لو احتجنا منع فعلي، ده بيتعمل بـ planTemplate على الجهاز.)
 */
export function deviceValidity(
  m: EligibilityInput,
  now: Date = new Date()
): { enabled: boolean; endTime: Date | null } {
  const blockedRegardlessOfTime =
    !!m.isBanned ||
    !m.isActive ||
    !!m.isFrozen ||
    (m.remainingCheckIns !== null && m.remainingCheckIns !== undefined && m.remainingCheckIns <= 0)

  if (blockedRegardlessOfTime) return { enabled: false, endTime: null }

  const exp = m.expiryDate ? new Date(m.expiryDate) : null
  if (exp && !isNaN(exp.getTime())) {
    if (exp < now) return { enabled: false, endTime: exp }
    return { enabled: true, endTime: exp }
  }
  // مفيش تاريخ انتهاء = اشتراك مفتوح
  return { enabled: true, endTime: null }
}
