/**
 * Safe localStorage wrapper for SSR compatibility
 * يوفر واجهة آمنة للتعامل مع localStorage في بيئة Next.js SSR
 */

export const safeStorage = {
  /**
   * قراءة قيمة من localStorage بأمان
   * @param key - مفتاح التخزين
   * @returns القيمة المخزنة أو null إذا لم توجد أو حدث خطأ
   */
  getItem: (key: string): string | null => {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      return localStorage.getItem(key)
    } catch (error) {
      console.error(`Error reading from localStorage (${key}):`, error)
      return null
    }
  },

  /**
   * حفظ قيمة في localStorage بأمان
   * @param key - مفتاح التخزين
   * @param value - القيمة المراد حفظها
   * @returns true إذا نجحت العملية، false إذا فشلت
   */
  setItem: (key: string, value: string): boolean => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      localStorage.setItem(key, value)
      return true
    } catch (error) {
      console.error(`Error writing to localStorage (${key}):`, error)
      return false
    }
  },

  /**
   * حذف قيمة من localStorage بأمان
   * @param key - مفتاح التخزين
   * @returns true إذا نجحت العملية، false إذا فشلت
   */
  removeItem: (key: string): boolean => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      localStorage.removeItem(key)
      return true
    } catch (error) {
      console.error(`Error removing from localStorage (${key}):`, error)
      return false
    }
  },

  /**
   * مسح جميع البيانات من localStorage بأمان
   * @returns true إذا نجحت العملية، false إذا فشلت
   */
  clear: (): boolean => {
    if (typeof window === 'undefined') {
      return false
    }

    try {
      localStorage.clear()
      return true
    } catch (error) {
      console.error('Error clearing localStorage:', error)
      return false
    }
  }
}

/**
 * فحص إذا كان الكود يعمل في بيئة المتصفح
 * @returns true إذا كان في المتصفح، false إذا كان في السيرفر
 */
export const isBrowser = (): boolean => {
  return typeof window !== 'undefined'
}

/**
 * فحص إذا كان document متاح
 * @returns true إذا كان document متاح
 */
export const isDocumentAvailable = (): boolean => {
  return typeof document !== 'undefined'
}
