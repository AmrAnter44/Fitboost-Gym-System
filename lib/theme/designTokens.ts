/**
 * Design Tokens - نظام التصميم الموحد
 * جميع القيم الثابتة للتصميم في مكان واحد
 *
 * استخدم هذه القيم بدلاً من Tailwind classes المباشرة للحفاظ على الاتساق
 */

export const SPACING = {
  xs: '0.5rem',    // 8px
  sm: '0.75rem',   // 12px
  md: '1rem',      // 16px
  lg: '1.5rem',    // 24px
  xl: '2rem',      // 32px
  '2xl': '3rem',   // 48px
  '3xl': '4rem',   // 64px
} as const

/**
 * Container Padding - موحد عبر جميع الصفحات
 */
export const CONTAINER_PADDING = {
  mobile: 'px-4 py-4',
  tablet: 'md:px-6 md:py-6',
  desktop: 'lg:px-8 lg:py-8',
  full: 'px-4 py-4 md:px-6 md:py-6'
} as const

export const BORDER_RADIUS = {
  none: 'rounded-none',
  sm: 'rounded-sm',     // 2px
  md: 'rounded-md',     // 6px
  lg: 'rounded-lg',     // 8px
  xl: 'rounded-xl',     // 12px
  '2xl': 'rounded-2xl', // 16px
  full: 'rounded-full'
} as const

export const SHADOWS = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl'
} as const

export const FONT_SIZES = {
  xs: 'text-xs',      // 12px
  sm: 'text-sm',      // 14px
  base: 'text-base',  // 16px
  lg: 'text-lg',      // 18px
  xl: 'text-xl',      // 20px
  '2xl': 'text-2xl',  // 24px
  '3xl': 'text-3xl',  // 30px
  '4xl': 'text-4xl'   // 36px
} as const

export const TRANSITIONS = {
  fast: 'transition-all duration-150',
  normal: 'transition-all duration-300',
  slow: 'transition-all duration-500'
} as const
