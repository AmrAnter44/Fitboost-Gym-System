//  بحث عربي ذكي — يوحّد اختلافات الكتابة الشائعة عشان "أحمد" == "احمد" == "احمـد"
//  يُستخدم في البحث بالاسم (PT / الأعضاء / إلخ) عشان النتائج تظهر رغم اختلاف الهمزات والتشكيل.

/**
 * تطبيع نص عربي/لاتيني للبحث:
 * - حروف صغيرة
 * - إزالة التشكيل والتطويل (ـ)
 * - توحيد الألف (أ إ آ ٱ → ا) والياء (ى → ي) والتاء المربوطة (ة → ه)
 * - توحيد الهمزات (ؤ → و، ئ → ي، ء → حذف)
 * - تحويل الأرقام العربية/الفارسية إلى لاتينية
 * - دمج المسافات المتكررة
 */
export function normalizeArabic(input?: string | null): string {
  if (!input) return ''
  return String(input)
    .toLowerCase()
    //  التشكيل + التطويل (kashida)
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    //  الألف بكل أشكالها
    .replace(/[آأإٱٲٳ]/g, 'ا')
    //  الألف المقصورة → ياء
    .replace(/ى/g, 'ي')
    //  التاء المربوطة → هاء
    .replace(/ة/g, 'ه')
    //  الهمزات
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    //  الأرقام العربية (٠-٩) → لاتينية
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    //  الأرقام الفارسية (۰-۹) → لاتينية
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    //  دمج المسافات
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * هل النص (haystack) بيطابق البحث (query)؟
 * بحث بالكلمات: كل كلمة في البحث لازم تكون موجودة في النص (بأي ترتيب).
 * فمثلاً "احمد شريف" بيلاقي "شريف احمد علي".
 */
export function matchesArabicQuery(haystack?: string | null, query?: string | null): boolean {
  const nq = normalizeArabic(query)
  if (!nq) return true
  const nh = normalizeArabic(haystack)
  if (!nh) return false
  const tokens = nq.split(' ').filter(Boolean)
  return tokens.every((tok) => nh.includes(tok))
}

/** يرجّع الأرقام فقط من النص (بعد تحويل الأرقام العربية) — للبحث برقم/تليفون */
export function digitsOnly(input?: string | null): string {
  return normalizeArabic(input).replace(/\D/g, '')
}
