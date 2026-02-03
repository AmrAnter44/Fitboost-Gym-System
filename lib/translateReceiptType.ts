// Helper function to translate receipt types
// استخدم هذه الدالة في كل مكان تريد عرض نوع الإيصال فيه

export function getReceiptTypeTranslationKey(type: string): string {
  // Map old hardcoded types to new translation keys
  const typeMap: { [key: string]: string } = {
    // New format (already using keys)
    'newNutrition': 'closing.receiptTypes.newNutrition',
    'nutritionDayUse': 'closing.receiptTypes.nutritionDayUse',
    'nutritionRenewal': 'closing.receiptTypes.nutritionRenewal',
    'newPhysiotherapy': 'closing.receiptTypes.newPhysiotherapy',
    'physiotherapyDayUse': 'closing.receiptTypes.physiotherapyDayUse',
    'physiotherapyRenewal': 'closing.receiptTypes.physiotherapyRenewal',
    'newPT': 'closing.receiptTypes.newPT',
    'ptDayUse': 'closing.receiptTypes.ptDayUse',
    'ptRenewal': 'closing.receiptTypes.ptRenewal',
    'newGroupClass': 'closing.receiptTypes.newGroupClass',
    'groupClassDayUse': 'closing.receiptTypes.groupClassDayUse',
    'groupClassRenewal': 'closing.receiptTypes.groupClassRenewal',
    'membershipRenewal': 'closing.receiptTypes.membershipRenewal',

    // Legacy types
    'member': 'closing.receiptTypes.member',
    'pt': 'closing.receiptTypes.pt',
    'dayUse': 'closing.receiptTypes.dayUse',
    'inBody': 'closing.receiptTypes.inBody',

    // Old Arabic types (for backward compatibility with old receipts in DB)
    'اشتراك تغذية جديد': 'closing.receiptTypes.newNutrition',
    'Nutrition Day Use': 'closing.receiptTypes.nutritionDayUse',
    'تجديد تغذية': 'closing.receiptTypes.nutritionRenewal',
    'اشتراك علاج طبيعي جديد': 'closing.receiptTypes.newPhysiotherapy',
    'Physiotherapy Day Use': 'closing.receiptTypes.physiotherapyDayUse',
    'تجديد علاج طبيعي': 'closing.receiptTypes.physiotherapyRenewal',
    'برايفت جديد': 'closing.receiptTypes.newPT',
    'PT Day Use': 'closing.receiptTypes.ptDayUse',
    'تجديد برايفت': 'closing.receiptTypes.ptRenewal',
    'اشتراك جروب كلاسيس جديد': 'closing.receiptTypes.newGroupClass',
    'GroupClass Day Use': 'closing.receiptTypes.groupClassDayUse',
    'تجديد جروب كلاسيس': 'closing.receiptTypes.groupClassRenewal',
    'تجديد عضويه': 'closing.receiptTypes.membershipRenewal',
    'تجديد عضوية': 'closing.receiptTypes.membershipRenewal',

    // Other types
    'Member': 'closing.receiptTypes.member',
    'PT': 'closing.receiptTypes.pt'
  }

  return typeMap[type] || type // Return the original type if no mapping found
}

/**
 * تحديد إذا كان الإيصال من نوع عضوية (Floor)
 */
export function isFloorReceipt(type: string): boolean {
  const floorTypes = [
    'Member',
    'membershipRenewal',
    'تجديد عضويه',
    'تجديد عضوية',
    'Payment'
  ]
  return floorTypes.includes(type)
}

/**
 * تحديد إذا كان الإيصال من نوع برايفت (PT)
 */
export function isPTReceipt(type: string): boolean {
  const ptTypes = [
    'PT',
    'newPT',
    'ptDayUse',
    'ptRenewal',
    'برايفت جديد',
    'PT Day Use',
    'تجديد برايفت',
    'اشتراك برايفت',
    'دفع باقي برايفت'
  ]
  return ptTypes.includes(type)
}

/**
 * تحديد إذا كان الإيصال من نوع تغذية
 */
export function isNutritionReceipt(type: string): boolean {
  const nutritionTypes = [
    'newNutrition',
    'nutritionDayUse',
    'nutritionRenewal',
    'اشتراك تغذية جديد',
    'Nutrition Day Use',
    'تجديد تغذية'
  ]
  return nutritionTypes.includes(type)
}

/**
 * تحديد إذا كان الإيصال من نوع علاج طبيعي
 */
export function isPhysiotherapyReceipt(type: string): boolean {
  const physioTypes = [
    'newPhysiotherapy',
    'physiotherapyDayUse',
    'physiotherapyRenewal',
    'اشتراك علاج طبيعي جديد',
    'Physiotherapy Day Use',
    'تجديد علاج طبيعي'
  ]
  return physioTypes.includes(type)
}

/**
 * تحديد إذا كان الإيصال من نوع جروب كلاسيس
 */
export function isGroupClassReceipt(type: string): boolean {
  const groupClassTypes = [
    'newGroupClass',
    'groupClassDayUse',
    'groupClassRenewal',
    'اشتراك جروب كلاسيس جديد',
    'GroupClass Day Use',
    'تجديد جروب كلاسيس'
  ]
  return groupClassTypes.includes(type)
}
