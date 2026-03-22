/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  publicExcludes: ['!uploads/**/*'],
});

const nextConfig = {
  // Enable standalone output for production
  output: 'standalone',

  // React strict mode
  reactStrictMode: true,

  // Allowed domains for external access + Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization'
          },
          // 🔒 Security Headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // منع MIME type sniffing
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY' // منع Clickjacking
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
    isrFlushToDisk: true
  }
};

module.exports = withPWA(nextConfig);
