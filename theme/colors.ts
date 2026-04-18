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
    50: '#fcfaee',
    100: '#f8f4d8',
    200: '#f0eab2',
    300: '#fded68',
    400: '#fce62b',
    500: '#fbe003',  // اللون الأساسي - أصفر
    600: '#cab402',
    700: '#a19002',
    800: '#7e7002',
    900: '#564e0b',
    950: '#322d06',
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
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '0 0 0'
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
