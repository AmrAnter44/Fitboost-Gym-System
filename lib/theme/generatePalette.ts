/**
 * Color Palette Generator
 * يولّد مجموعة ألوان (50-950) من لون أساسي واحد
 */

function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100
  l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * Math.max(0, Math.min(1, color)))
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

export function hexToRgbString(hex: string): string {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return `${r} ${g} ${b}`
}

export interface ColorPalette {
  [shade: string]: { hex: string; rgb: string }
}

export function generatePalette(baseHex: string): ColorPalette {
  const { h, s } = hexToHSL(baseHex)

  // Target lightness values for each shade (Tailwind-like distribution)
  const shadeMap: Record<string, number> = {
    '50': 96,
    '100': 91,
    '200': 82,
    '300': 70,
    '400': 58,
    '500': 49,
    '600': 40,
    '700': 32,
    '800': 25,
    '900': 19,
    '950': 11,
  }

  const palette: ColorPalette = {}

  for (const [shade, lightness] of Object.entries(shadeMap)) {
    // Adjust saturation slightly for lighter/darker shades
    let adjS = s
    if (lightness > 80) adjS = Math.max(s * 0.7, 20)
    if (lightness < 25) adjS = Math.max(s * 0.8, 15)

    const hex = hslToHex(h, adjS, lightness)
    palette[shade] = {
      hex,
      rgb: hexToRgbString(hex),
    }
  }

  return palette
}

/**
 * Compute a readable text color (#000 or #fff) for a given hex background.
 * Uses YIQ luminance — light backgrounds get dark text, dark backgrounds get white.
 */
export function getContrastText(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#0F172A' : '#FFFFFF'
}

export type PrimaryTextOverride = 'auto' | 'white' | 'black'

/**
 * Apply primary-contrast CSS variables based on user override (or auto from base color)
 */
export function applyPrimaryTextOverride(baseHex: string, override: PrimaryTextOverride): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const palette = generatePalette(baseHex)

  let c500: string, c600: string, c700: string
  if (override === 'white') {
    c500 = c600 = c700 = '#FFFFFF'
  } else if (override === 'black') {
    c500 = c600 = c700 = '#0F172A'
  } else {
    c500 = getContrastText(palette['500'].hex)
    c600 = getContrastText(palette['600'].hex)
    c700 = getContrastText(palette['700'].hex)
  }
  root.style.setProperty('--color-primary-contrast', c500)
  root.style.setProperty('--color-primary-contrast-600', c600)
  root.style.setProperty('--color-primary-contrast-700', c700)
}

/**
 * تطبيق الألوان على CSS variables في document
 */
export function applyPaletteToDOM(baseHex: string): void {
  const palette = generatePalette(baseHex)
  const root = document.documentElement

  for (const [shade, { hex, rgb }] of Object.entries(palette)) {
    root.style.setProperty(`--color-primary-${shade}`, hex)
    root.style.setProperty(`--color-primary-${shade}-rgb`, rgb)
  }

  // Contrast text colors — respect user override if present
  const override = (typeof localStorage !== 'undefined'
    ? localStorage.getItem('primaryTextOverride')
    : null) as PrimaryTextOverride | null
  applyPrimaryTextOverride(baseHex, override === 'white' || override === 'black' ? override : 'auto')
}

/**
 * Inline script string for blocking script in layout
 * يتم تضمينه في blocking script لتجنب وميض اللون الخاطئ
 */
export function getColorBlockingScript(): string {
  return `
    (function() {
      try {
        var pc = localStorage.getItem('primaryColor');
        if (!pc) return;

        function hexToHSL(hex) {
          hex = hex.replace('#', '');
          var r = parseInt(hex.substring(0, 2), 16) / 255;
          var g = parseInt(hex.substring(2, 4), 16) / 255;
          var b = parseInt(hex.substring(4, 6), 16) / 255;
          var max = Math.max(r, g, b), min = Math.min(r, g, b);
          var h = 0, s = 0, l = (max + min) / 2;
          if (max !== min) {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            else if (max === g) h = ((b - r) / d + 2) / 6;
            else h = ((r - g) / d + 4) / 6;
          }
          return { h: h * 360, s: s * 100, l: l * 100 };
        }

        function hslToHex(h, s, l) {
          s /= 100; l /= 100;
          var a = s * Math.min(l, 1 - l);
          function f(n) {
            var k = (n + h / 30) % 12;
            var c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * Math.max(0, Math.min(1, c))).toString(16).padStart(2, '0');
          }
          return '#' + f(0) + f(8) + f(4);
        }

        var hsl = hexToHSL(pc);
        var shades = {50:96,100:91,200:82,300:70,400:58,500:49,600:40,700:32,800:25,900:19,950:11};
        var root = document.documentElement;
        var contrastForShade = {};

        for (var shade in shades) {
          var lgt = shades[shade];
          var adjS = hsl.s;
          if (lgt > 80) adjS = Math.max(hsl.s * 0.7, 20);
          if (lgt < 25) adjS = Math.max(hsl.s * 0.8, 15);
          var hex = hslToHex(hsl.h, adjS, lgt);
          var hx = hex.replace('#', '');
          var rN = parseInt(hx.substring(0,2),16);
          var gN = parseInt(hx.substring(2,4),16);
          var bN = parseInt(hx.substring(4,6),16);
          var rgb = rN + ' ' + gN + ' ' + bN;
          root.style.setProperty('--color-primary-' + shade, hex);
          root.style.setProperty('--color-primary-' + shade + '-rgb', rgb);
          var yiq = (rN * 299 + gN * 587 + bN * 114) / 1000;
          contrastForShade[shade] = yiq >= 150 ? '#0F172A' : '#FFFFFF';
        }

        // Respect user override (auto / white / black)
        var override = localStorage.getItem('primaryTextOverride');
        var c500, c600, c700;
        if (override === 'white') { c500 = c600 = c700 = '#FFFFFF'; }
        else if (override === 'black') { c500 = c600 = c700 = '#0F172A'; }
        else { c500 = contrastForShade['500']; c600 = contrastForShade['600']; c700 = contrastForShade['700']; }
        root.style.setProperty('--color-primary-contrast', c500);
        root.style.setProperty('--color-primary-contrast-600', c600);
        root.style.setProperty('--color-primary-contrast-700', c700);
      } catch(e) {}
    })();
  `
}
