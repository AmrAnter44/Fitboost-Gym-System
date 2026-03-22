import './globals.css'
import type { Metadata, Viewport } from 'next'
import ClientLayout from '../components/ClientLayout'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  themeColor: '#ff9915',
}

export const metadata: Metadata = {
  title: 'نظام إدارة الصالة الرياضية - Gym System',
  description: 'نظام شامل لإدارة صالات الرياضة مع البحث السريع',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Gym System',
    startupImage: [
      {
        url: '/splash/apple-splash-2048-2732.png',
        media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1668-2388.png',
        media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1536-2048.png',
        media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1668-2224.png',
        media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1620-2160.png',
        media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1290-2796.png',
        media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1179-2556.png',
        media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1284-2778.png',
        media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1170-2532.png',
        media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1125-2436.png',
        media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1242-2688.png',
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-828-1792.png',
        media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-1242-2208.png',
        media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-750-1334.png',
        media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
      {
        url: '/splash/apple-splash-640-1136.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
      },
    ],
  },
  applicationName: 'Gym System',
  keywords: ['gym', 'fitness', 'management', 'صالة رياضية', 'إدارة', 'جيم'],
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/icon.svg', color: '#ff9915' },
    ],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ⚡ تحميل الإعدادات من localStorage قبل React hydration - BLOCKING SCRIPT */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var html = document.documentElement;

                  // تطبيق Dark Mode فورًا
                  var darkMode = localStorage.getItem('darkMode');

                  if (darkMode === 'true') {
                    html.classList.add('dark');
                  } else {
                    html.classList.remove('dark');
                  }

                  // تطبيق اللغة فورًا
                  var locale = localStorage.getItem('locale') || 'ar';

                  html.setAttribute('lang', locale);
                  html.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');

                  // تطبيق اللون الأساسي فورًا
                  var pc = localStorage.getItem('primaryColor');
                  if (pc) {
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
                    var root = html;
                    for (var shade in shades) {
                      var lgt = shades[shade];
                      var adjS = hsl.s;
                      if (lgt > 80) adjS = Math.max(hsl.s * 0.7, 20);
                      if (lgt < 25) adjS = Math.max(hsl.s * 0.8, 15);
                      var hex = hslToHex(hsl.h, adjS, lgt);
                      var hx = hex.replace('#', '');
                      var rgb = parseInt(hx.substring(0,2),16)+' '+parseInt(hx.substring(2,4),16)+' '+parseInt(hx.substring(4,6),16);
                      root.style.setProperty('--color-primary-' + shade, hex);
                      root.style.setProperty('--color-primary-' + shade + '-rgb', rgb);
                    }
                  }

                } catch (e) {
                  console.error('❌ Failed to load settings:', e);
                }
              })();
            `,
          }}
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />

        {/* PWA Icons - iOS */}
        <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />

        {/* iOS Splash Screens - handled in metadata */}

        {/* Meta tags for PWA */}
        <meta name="application-name" content="Gym System" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Gym System" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#ff9915" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* PWA Display Mode */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes, viewport-fit=cover" />

        {/* Disable iOS auto-zoom on input focus */}
        <meta name="maximum-scale" content="5" />

        {/* Chrome Android */}
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Local Cairo Font */}
        <link rel="stylesheet" href="/fonts/cairo.css" />
      </head>
      <body className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}