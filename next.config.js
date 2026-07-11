/** @type {import('next').NextConfig} */

//  استراتيجيات الكاش الافتراضية من next-pwa (أصول ثابتة، صور، فونتس… إلخ)
const defaultRuntimeCaching = require('next-pwa/cache');

//  ⚠️ مهم: البيانات الحيّة (API) لازم تيجي من السيرفر مباشرة من غير أي كاش.
//  الافتراضي كان بيكاش كل /api لمدة 24 ساعة (NetworkFirst) — ده كان بيرجّع بيانات
//  قديمة (مثلاً الأعضاء المشتركين مبيتحدّثوش) وأحيانًا بيرمي "Failed to fetch".
const runtimeCaching = [
  {
    urlPattern: ({ url }) => self.origin === url.origin && url.pathname.startsWith('/api/'),
    handler: 'NetworkOnly',
  },
  //  نسيب باقي الاستراتيجيات زي ما هي ماعدا كاش الـ API
  ...defaultRuntimeCaching.filter((entry) => !(entry.options && entry.options.cacheName === 'apis')),
];

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  publicExcludes: ['!uploads/**/*'],
  runtimeCaching,
});

const nextConfig = {
  // Enable standalone output for production
  output: 'standalone',

  // React strict mode
  reactStrictMode: true,

  // Rewrite uploads to serve-image API (for Electron production)
  // بدون ده صور الأعضاء/الشعار بتطلّع 404 في نسخة Electron
  async rewrites() {
    return process.env.UPLOADS_PATH ? [
      {
        source: '/uploads/:path*',
        destination: '/api/serve-image?path=/uploads/:path*',
      },
    ] : [];
  },

  // Security Headers
  // ملاحظة: اتشال Access-Control-Allow-Origin: * (كان بيفتح كل الـ API لأي origin).
  // التطبيق same-origin، والموبايل native app مش بيتأثر بـ CORS. لو فيه واجهة ويب
  // على دومين مختلف بتنادي الـ API، ضيف ACAO مقيّد للدومين ده هنا.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // منع MIME type sniffing
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN' // منع Clickjacking (SAMEORIGIN عشان الـ Electron webview)
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block' // حماية من XSS في المتصفحات القديمة
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin' // حماية الـ privacy
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()' // منع الوصول للكاميرا/ميكروفون
          }
        ]
      }
    ];
  },

  // Image optimization
  images: {
    domains: ['system.xgym.website', 'xgym.website'],
    unoptimized: true
  },

  // TypeScript config
  typescript: {
    ignoreBuildErrors: false
  },

  // ESLint config
  eslint: {
    ignoreDuringBuilds: false
  },

  // Webpack config for better performance
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }

    return config;
  },

  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4001',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'system.xgym.website',
    NEXT_PUBLIC_APP_VERSION: require('./package.json').version
  },

  // Experimental features
  experimental: {
    isrFlushToDisk: true,
    instrumentationHook: true, // تفعيل instrumentation.ts لتتبع أخطاء السيرفر
    optimizePackageImports: ['recharts', '@tanstack/react-query'] // تقليل حجم الـ bundle
  }
};

module.exports = withPWA(nextConfig);
