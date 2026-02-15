import type { Config } from 'tailwindcss'
import { THEME_COLORS } from './lib/theme/colors'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ✅ ربط الألوان من النظام المركزي
        primary: THEME_COLORS.primary,
        secondary: THEME_COLORS.secondary,
        accent: THEME_COLORS.accent,
        danger: THEME_COLORS.danger,

        // إبقاء الألوان الافتراضية لـ Tailwind
        blue: THEME_COLORS.primary, // redirect blue-* to primary-*
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}

export default config