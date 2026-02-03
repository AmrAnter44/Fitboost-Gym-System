/**
 * Theme Configuration
 * إعدادات Theme الشاملة
 */

import { THEME_COLORS } from './colors'

export const THEME_CONFIG = {
  colors: THEME_COLORS,

  // إعدادات إضافية
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
  },

  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },

  // Animation settings
  transitions: {
    fast: '150ms',
    normal: '300ms',
    slow: '500ms',
  }
} as const

export default THEME_CONFIG
