/**
 * Central Color System
 * نظام الألوان المركزي لـ X Gym
 *
 * جميع الألوان الأساسية للنظام في مكان واحد
 * لتغيير الألوان، عدّل القيم هنا مباشرة
 */

/**
 * الألوان الأساسية للنظام
 * غيّر الألوان من هنا لتحديث theme النظام بالكامل
 */
export const THEME_COLORS = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',  // اللون الأساسي
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
  },

  // ألوان إضافية
  secondary: {
    500: '#10b981', // أخضر
  },

  accent: {
    500: '#f59e0b', // برتقالي
  },

  danger: {
    500: '#ef4444', // أحمر
  }
} as const

/**
 * Helper function للحصول على لون hex
 */
export function getColor(color: keyof typeof THEME_COLORS, shade: number = 500): string {
  return (THEME_COLORS[color] as any)[shade] || THEME_COLORS.primary[500]
}

/**
 * RGB Values لـ CSS Variables
 */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '0, 0, 0'
}

// Export RGB values
export const THEME_COLORS_RGB = {
  primary: {
    50: hexToRgb(THEME_COLORS.primary[50]),
    100: hexToRgb(THEME_COLORS.primary[100]),
    200: hexToRgb(THEME_COLORS.primary[200]),
    300: hexToRgb(THEME_COLORS.primary[300]),
    400: hexToRgb(THEME_COLORS.primary[400]),
    500: hexToRgb(THEME_COLORS.primary[500]),
    600: hexToRgb(THEME_COLORS.primary[600]),
    700: hexToRgb(THEME_COLORS.primary[700]),
    800: hexToRgb(THEME_COLORS.primary[800]),
    900: hexToRgb(THEME_COLORS.primary[900]),
    950: hexToRgb(THEME_COLORS.primary[950]),
  }
} as const

// Export للاستخدام السريع
export const PRIMARY_COLOR = THEME_COLORS.primary[500]
export const PRIMARY_DARK = THEME_COLORS.primary[700]
export const PRIMARY_LIGHT = THEME_COLORS.primary[300]
