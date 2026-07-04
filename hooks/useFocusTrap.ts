import { useEffect, useRef, RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])'

/**
 * Hook للـ Focus Trap - يحصر التنقل بالـ Tab داخل عنصر (modal / dialog) طالما أنه مفتوح.
 *
 * - عند التفعيل: يحفظ العنصر المركّز عليه سابقاً، ثم ينقل التركيز لأول عنصر قابل للتركيز
 *   داخل ref (ما لم يكن هناك عنصر يحمل autoFocus بالفعل داخل اللوحة، فيُحترم).
 * - أثناء التفعيل: يلتقط Tab / Shift+Tab ويدور التركيز داخل الحاوية (من الأخير→الأول ومن الأول→الأخير).
 * - عند الإغلاق / الإزالة: يعيد التركيز للعنصر المحفوظ.
 *
 * جميع عمليات الـ DOM محمية للـ SSR (typeof document !== 'undefined').
 *
 * @param ref - مرجع لعنصر الحاوية (لوحة الـ modal)
 * @param active - هل الـ trap مفعّل (عادة نفس قيمة isOpen)
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean): void {
  const previouslyFocused = useRef<HTMLElement | null>(null)

  // نلتقط - أثناء الـ render وقبل أن يطبّق React أي autoFocus في مرحلة الـ commit -
  // العنصر الذي كان مركّزاً عليه قبل فتح الـ trap، حتى نعيد إليه التركيز عند الإغلاق.
  if (active && previouslyFocused.current === null && typeof document !== 'undefined') {
    const el = document.activeElement as HTMLElement | null
    if (el && el !== document.body && !ref.current?.contains(el)) {
      previouslyFocused.current = el
    }
  }

  useEffect(() => {
    if (!active) return
    if (typeof document === 'undefined') return

    const container = ref.current
    if (!container) return

    // التقاط احتياطي في حال لم يُلتقط العنصر السابق أثناء الـ render
    if (previouslyFocused.current === null) {
      const el = document.activeElement as HTMLElement | null
      if (el && el !== document.body && !container.contains(el)) {
        previouslyFocused.current = el
      }
    }

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )

    // إن لم يكن التركيز داخل اللوحة بالفعل (مثلاً عبر autoFocus) ننقله لأول عنصر قابل للتركيز.
    if (!container.contains(document.activeElement)) {
      const focusable = getFocusable()
      ;(focusable[0] ?? container).focus()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const items = getFocusable()
      if (items.length === 0) {
        e.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement

      if (e.shiftKey) {
        // Shift+Tab من أول عنصر (أو من خارج الحاوية) → ننتقل للأخير
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        // Tab من آخر عنصر (أو من خارج الحاوية) → ننتقل للأول
        if (activeEl === last || !container.contains(activeEl)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      // إعادة التركيز للعنصر المحفوظ عند الإغلاق / الإزالة
      const toRestore = previouslyFocused.current
      previouslyFocused.current = null
      if (toRestore && typeof toRestore.focus === 'function') {
        toRestore.focus()
      }
    }
  }, [ref, active])
}
