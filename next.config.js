/** @type {import('next').NextConfig} */

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development'
});

const nextConfig = {
  // Enable standalone output for production
  output: 'standalone',

  // React strict mode
  reactStrictMode: true,

  // Allowed domains for external access
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
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'system.xgym.website'
  },

  // Experimental features
  experimental: {
    isrFlushToDisk: true
  }
};

module.exports = withPWA(nextConfig);
