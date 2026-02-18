import { useState, useEffect } from 'react'

/**
 * Hook للـ debounce - يؤخر تحديث القيمة حتى يتوقف المستخدم عن الكتابة
 *
 * @param value - القيمة المراد عمل debounce لها
 * @param delay - وقت الانتظار بالميلي ثانية (افتراضي: 300ms)
 * @returns القيمة المؤجلة (debounced value)
 *
 * @example
 * ```tsx
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 500)
 *
 * useEffect(() => {
 *   // سيتم استدعاؤه فقط بعد 500ms من توقف المستخدم عن الكتابة
 *   searchAPI(debouncedSearch)
 * }, [debouncedSearch])
 * ```
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    // إنشاء timer سينفذ بعد delay
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    // Cleanup: إلغاء الـ timer القديم إذا تغيرت value قبل انتهاء delay
    // هذا يضمن أننا ننتظر حتى يتوقف المستخدم عن الكتابة تماماً
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
