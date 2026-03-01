/**
 * Central Color System
 * نظام الألوان المركزي لـ Fitboost System
 *
 * جميع الألوان الأساسية للنظام في مكان واحد
 * لتغيير الألوان، عدّل القيم هنا مباشرة
 */

/**
 * الألوان الأساسية للنظام - Fitboost Brand Identity
 * غيّر الألوان من هنا لتحديث theme النظام بالكامل
 */
export const THEME_COLORS = {
  primary: {
    50: '#fff8ed',    // أفتح برتقالي
    100: '#ffedd1',
    200: '#ffdaa3',
    300: '#ffc46a',
    400: '#ffa62f',
    500: '#ff9915',  // اللون الأساسي - برتقالي
    600: '#e67d00',
    700: '#bf6200',
    800: '#994d00',
    900: '#663300',
    950: '#331a00',
  },

  // ألوان إضافية
  secondary: {
    50: '#fff2f2',
    100: '#ffd9d9',
    200: '#ffbfbf',
    300: '#ffa6a6',
    400: '#ff8c8c',
    500: '#FA8072', // مرجاني/سالمون (من الهوية البصرية)
    600: '#f5635f',
    700: '#f04a4a',
    800: '#eb3030',
    900: '#d91e1e',
  },

  accent: {
    500: '#FA8072', // مرجاني
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
