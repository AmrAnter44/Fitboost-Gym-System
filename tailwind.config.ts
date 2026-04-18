import type { Config } from 'tailwindcss'
import { THEME_COLORS } from './lib/theme/colors'

// CSS variable-based primary colors for dynamic theming
// Uses RGB format to support Tailwind opacity modifiers (e.g., bg-primary-500/20)
const primaryFromCSS = {
  50: 'rgb(var(--color-primary-50-rgb) / <alpha-value>)',
  100: 'rgb(var(--color-primary-100-rgb) / <alpha-value>)',
  200: 'rgb(var(--color-primary-200-rgb) / <alpha-value>)',
  300: 'rgb(var(--color-primary-300-rgb) / <alpha-value>)',
  400: 'rgb(var(--color-primary-400-rgb) / <alpha-value>)',
  500: 'rgb(var(--color-primary-500-rgb) / <alpha-value>)',
  600: 'rgb(var(--color-primary-600-rgb) / <alpha-value>)',
  700: 'rgb(var(--color-primary-700-rgb) / <alpha-value>)',
  800: 'rgb(var(--color-primary-800-rgb) / <alpha-value>)',
  900: 'rgb(var(--color-primary-900-rgb) / <alpha-value>)',
  950: 'rgb(var(--color-primary-950-rgb) / <alpha-value>)',
}

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
        // ✅ ألوان ديناميكية عبر CSS variables
        primary: primaryFromCSS,
        secondary: THEME_COLORS.secondary,
        accent: THEME_COLORS.accent,
        danger: THEME_COLORS.danger,

        // إبقاء الألوان الافتراضية لـ Tailwind
        blue: primaryFromCSS, // redirect blue-* to primary-*
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