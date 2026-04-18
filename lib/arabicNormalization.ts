/**
 * تطبيع النص العربي للبحث الذكي
 * يوحد الهمزات والحروف المتشابهة ويزيل التشكيل
 *
 * @example
 * normalizeArabic('أحمد') === normalizeArabic('احمد') // true
 * normalizeArabic('إبراهيم') === normalizeArabic('ابراهيم') // true
 * normalizeArabic('مُحَمَّد') === normalizeArabic('محمد') // true
 */
export function normalizeArabic(text: string): string {
  if (!text) return ''

  return text
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')  // توحيد الهمزات على الألف
    .replace(/[ىي]/g, 'ي')    // توحيد الياء
    .replace(/ة/g, 'ه')       // تاء مربوطة -> هاء
    .replace(/[ًٌٍَُِّْٰ]/g, '') // إزالة التشكيل (فتحة، ضمة، كسرة، سكون، شدة، تنوين)
    .trim()
}

/**
 * بحث ذكي في النص العربي
 */
export function arabicIncludes(text: string, search: string): boolean {
  return normalizeArabic(text).includes(normalizeArabic(search))
}
