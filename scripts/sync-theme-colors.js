#!/usr/bin/env node

/**
 * Theme Colors Sync Script
 * مزامنة الألوان من lib/theme/colors.ts إلى app/globals.css
 *
 * Usage: node scripts/sync-theme-colors.js
 */

const fs = require('fs')
const path = require('path')

// قراءة ملف الألوان
const colorsPath = path.join(__dirname, '../lib/theme/colors.ts')
const globalsCssPath = path.join(__dirname, '../app/globals.css')

console.log('🎨 Starting theme colors sync...')

// قراءة محتوى ملف الألوان
let colorsContent = fs.readFileSync(colorsPath, 'utf8')

// استخراج الألوان من THEME_COLORS
const primaryColorsMatch = colorsContent.match(/primary:\s*{([^}]+)}/s)
if (!primaryColorsMatch) {
  console.error('❌ Could not find primary colors in theme file')
  process.exit(1)
}

const primaryColors = {}
const colorLines = primaryColorsMatch[1].split('\n')

colorLines.forEach(line => {
  const match = line.match(/(\d+):\s*['"]([^'"]+)['"]/)
  if (match) {
    primaryColors[match[1]] = match[2]
  }
})

console.log('✅ Extracted colors:', Object.keys(primaryColors).length, 'shades')

// تحويل hex إلى RGB
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '0, 0, 0'
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
}

// بناء CSS variables
let cssVars = `:root {
  /* Primary Colors - الألوان الأساسية */
`

// إضافة HEX colors
Object.entries(primaryColors).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([shade, color]) => {
  cssVars += `  --color-primary-${shade}: ${color};\n`
})

cssVars += `
  /* RGB Values for transparency */
`

// إضافة RGB colors
Object.entries(primaryColors).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([shade, color]) => {
  cssVars += `  --color-primary-${shade}-rgb: ${hexToRgb(color)};\n`
})

cssVars += `
  /* Other colors */
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 249, 250, 251;
  --background-end-rgb: 249, 250, 251;
}`

// بناء Dark mode colors (عكس الترتيب)
let darkModeVars = `
/* Dark Mode Colors */
.dark {
  /* Dark Mode Primary Colors */
`

const sortedColors = Object.entries(primaryColors).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
const reversedColors = [...sortedColors].reverse()

sortedColors.forEach(([shade, _], index) => {
  const reversedColor = reversedColors[index][1]
  darkModeVars += `  --color-primary-${shade}: ${reversedColor};\n`
})

darkModeVars += `
  /* Dark Mode Background & Foreground */
  --foreground-rgb: 255, 255, 255;
  --background-start-rgb: 17, 24, 39;
  --background-end-rgb: 17, 24, 39;
}`

// قراءة globals.css الحالي
let globalsCss = fs.readFileSync(globalsCssPath, 'utf8')

// استبدال قسم :root
globalsCss = globalsCss.replace(
  /:root\s*{[\s\S]*?^}/m,
  cssVars
)

// استبدال قسم .dark
globalsCss = globalsCss.replace(
  /\/\*\s*Dark Mode Colors\s*\*\/\s*\.dark\s*{[\s\S]*?^}/m,
  darkModeVars
)

// حفظ الملف المحدث
fs.writeFileSync(globalsCssPath, globalsCss, 'utf8')

console.log('✅ Successfully synced theme colors to globals.css')
console.log('📄 Primary color:', primaryColors['500'])
console.log('🎨 Total shades:', Object.keys(primaryColors).length)
console.log('')
console.log('✨ Theme colors are now in sync!')
