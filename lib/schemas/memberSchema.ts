import { z } from 'zod'

const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const safeNameRegex = /^[\u0600-\u06FFa-zA-Z0-9\s\-_.'()]+$/

const safeNumber = (min: number, max: number) =>
  z.coerce.number({ message: 'يجب أن يكون رقماً' })
    .min(min, `القيمة الأدنى ${min}`)
    .max(max, `القيمة الأقصى ${max}`)
    .finite()

// Optional number: null/undefined/"" = غير محدد
// لو min > 0: الصفر كمان بيعتبر "غير محدد" (زي referral ID اللي لازم > 0)
// لو min = 0: الصفر قيمة صحيحة (زي عدد جلسات مجانية)
const optionalSafeNumber = (min: number, max: number) =>
  z.preprocess(
    (val) => {
      if (val === null || val === undefined || val === '') return null
      if (min > 0 && (val === 0 || val === '0')) return null
      return val
    },
    z.union([z.null(), safeNumber(min, max)])
  )

const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'تاريخ غير صحيح' }
)

export const memberCreateSchema = z.object({
  memberNumber: optionalSafeNumber(1, 9_999_999),

  name: z.string()
    .trim()
    .min(2, 'الاسم قصير جداً')
    .max(100, 'الاسم طويل جداً')
    .regex(safeNameRegex, 'الاسم يحتوي على رموز غير مسموحة'),

  phone: z.string()
    .trim()
    .regex(egyptianPhoneRegex, 'رقم الهاتف غير صحيح (يجب أن يبدأ بـ 010/011/012/015 ويكون 11 رقم)'),

  backupPhone: z.union([
    z.literal(''),
    z.null(),
    z.undefined(),
    z.string().regex(egyptianPhoneRegex, 'رقم الهاتف الاحتياطي غير صحيح')
  ]).optional().nullable(),

  email: z.union([
    z.literal(''),
    z.null(),
    z.undefined(),
    z.string().regex(emailRegex, 'البريد الإلكتروني غير صحيح').max(254)
  ]).optional().nullable(),

  nationalId: z.union([
    z.literal(''),
    z.null(),
    z.undefined(),
    z.string().regex(/^[0-9]{14}$/, 'الرقم القومي يجب أن يكون 14 رقم')
  ]).optional().nullable(),

  birthDate: z.union([z.literal(''), z.null(), z.undefined(), isoDateString]).optional().nullable(),
  startDate: z.union([z.literal(''), z.null(), z.undefined(), isoDateString]).optional().nullable(),
  expiryDate: z.union([z.literal(''), z.null(), z.undefined(), isoDateString]).optional().nullable(),
  remainingDueDate: z.union([z.literal(''), z.null(), z.undefined(), isoDateString]).optional().nullable(),
  customCreatedAt: z.union([z.literal(''), z.null(), z.undefined(), isoDateString]).optional().nullable(),

  source: z.string().max(100).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  staffName: z.string().max(100).optional().nullable(),

  subscriptionPrice: safeNumber(0, 1_000_000),
  remainingAmount: optionalSafeNumber(0, 1_000_000),

  freePTSessions: optionalSafeNumber(0, 1000),
  freeNutritionSessions: optionalSafeNumber(0, 1000),
  freePhysioSessions: optionalSafeNumber(0, 1000),
  freeGroupClassSessions: optionalSafeNumber(0, 1000),
  freePoolSessions: optionalSafeNumber(0, 1000),
  freePadelSessions: optionalSafeNumber(0, 1000),
  freeAssessmentSessions: optionalSafeNumber(0, 1000),
  invitations: optionalSafeNumber(0, 1000),
  remainingFreezeDays: optionalSafeNumber(0, 365),
  ptCommissionAmount: optionalSafeNumber(0, 1_000_000),
  referralMemberNumber: optionalSafeNumber(1, 9_999_999),

  profileImage: z.string().max(10_000_000).optional().nullable(),
  idCardFront: z.string().max(10_000_000).optional().nullable(),
  idCardBack: z.string().max(10_000_000).optional().nullable(),
  inBodyScans: z.any().optional().nullable(),

  paymentMethod: z.any().optional().nullable(),
  isOther: z.boolean().optional().nullable(),
  skipReceipt: z.boolean().optional().nullable(),
  coachId: z.string().max(50).optional().nullable(),
  salesStaffId: z.string().max(50).optional().nullable(),
  allowedCheckInStart: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal('').transform(() => null)),
  allowedCheckInEnd: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/).optional().nullable().or(z.literal('').transform(() => null)),
}).passthrough()

export type MemberCreateInput = z.infer<typeof memberCreateSchema>

export function formatZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 3)
  return issues
    .map(i => `${i.path.join('.')}: ${i.message}`)
    .join('; ')
}
