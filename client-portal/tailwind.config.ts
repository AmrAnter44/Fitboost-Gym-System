import type { Config } from "tailwindcss";

// ✅ استيراد الألوان من النظام الأساسي
import { THEME_COLORS } from "../lib/theme/colors";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ✅ استخدام نفس الألوان من النظام المركزي
        primary: THEME_COLORS.primary,
        secondary: THEME_COLORS.secondary,
        accent: THEME_COLORS.accent,
        danger: THEME_COLORS.danger,
      },
    },
  },
  plugins: [],
};

export default config;
