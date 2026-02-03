// Receipt Type Constants
// استخدم هذه الـ constants في كل مكان بدلاً من كتابة النصوص مباشرة

export const RECEIPT_TYPES = {
  // Nutrition
  NEW_NUTRITION: 'newNutrition',
  NUTRITION_DAY_USE: 'nutritionDayUse',
  NUTRITION_RENEWAL: 'nutritionRenewal',

  // Physiotherapy
  NEW_PHYSIOTHERAPY: 'newPhysiotherapy',
  PHYSIOTHERAPY_DAY_USE: 'physiotherapyDayUse',
  PHYSIOTHERAPY_RENEWAL: 'physiotherapyRenewal',

  // PT
  NEW_PT: 'newPT',
  PT_DAY_USE: 'ptDayUse',
  PT_RENEWAL: 'ptRenewal',

  // Group Class
  NEW_GROUP_CLASS: 'newGroupClass',
  GROUP_CLASS_DAY_USE: 'groupClassDayUse',
  GROUP_CLASS_RENEWAL: 'groupClassRenewal',

  // Member
  MEMBERSHIP_RENEWAL: 'membershipRenewal',

  // Legacy types (for backward compatibility)
  MEMBER: 'member',
  PT: 'pt',
  DAY_USE: 'dayUse',
  INBODY: 'inBody'
} as const

export type ReceiptType = typeof RECEIPT_TYPES[keyof typeof RECEIPT_TYPES]
