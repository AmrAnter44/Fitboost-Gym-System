import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // ⚡ Performance: Early return for static assets with long cache
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return response
  }

  // ✅ الصفحات العامة (Public Routes) - لا تحتاج authentication
  const publicRoutes = ['/check', '/api/check']
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))

  // ✅ إضافة headers لمنع الcaching على API routes
  if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
  } else {
    // Better caching for HTML pages
    response.headers.set('Cache-Control', 'private, no-cache, must-revalidate')
  }

  // Performance headers for faster local network
  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')

  // 🔒 Security Headers
  // Prevent clickjacking attacks
  response.headers.set('X-Frame-Options', 'DENY')

  // XSS protection (legacy but still useful for older browsers)
  response.headers.set('X-XSS-Protection', '1; mode=block')

  // HSTS - Force HTTPS in production only
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // Content Security Policy - Restrict resource loading
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-inline needed for Next.js
    "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for inline styles
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.github.com https://raw.githubusercontent.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  response.headers.set('Content-Security-Policy', cspDirectives)

  // Permissions Policy - Disable unnecessary browser features
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

  // ملاحظة: الصفحات في publicRoutes متاحة للجميع
  // في حالة إضافة authentication مستقبلاً، تأكد من استثناء هذه الصفحات

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp).*)',
  ]
}