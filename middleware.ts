import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// مسارات معفاة من فحص CSRF (مثل webhooks خارجية إن وُجدت)
const CSRF_EXEMPT_PATHS: string[] = [
  '/api/public/', // Public endpoints used by mobile app (no browser origin)
]

function isAllowedOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false

  try {
    const originUrl = new URL(origin)
    if (originUrl.host === host) return true

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (appUrl) {
      const appHost = new URL(appUrl).host
      if (originUrl.host === appHost) return true
    }

    const websiteUrl = process.env.NEXT_PUBLIC_WEBSITE_URL
    if (websiteUrl) {
      const websiteHost = new URL(websiteUrl).host
      if (originUrl.host === websiteHost) return true
    }

    return false
  } catch {
    return false
  }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const pathname = request.nextUrl.pathname

  // ⚡ Performance: Early return for static assets with long cache
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js|ttf|woff|woff2|eot)$/)
  ) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    return response
  }

  // 🔒 CSRF Protection: تحقق من Origin على طلبات التعديل
  if (
    pathname.startsWith('/api/') &&
    MUTATION_METHODS.has(request.method) &&
    !CSRF_EXEMPT_PATHS.some(p => pathname.startsWith(p))
  ) {
    const origin = request.headers.get('origin')
    const referer = request.headers.get('referer')
    const host = request.headers.get('host')

    // إذا لم يكن هناك Origin، استخدم Referer كـ fallback
    let sourceOrigin = origin
    if (!sourceOrigin && referer) {
      try {
        sourceOrigin = new URL(referer).origin
      } catch {
        sourceOrigin = null
      }
    }

    if (!isAllowedOrigin(sourceOrigin, host)) {
      return NextResponse.json(
        { error: 'CSRF: طلب غير موثوق. مصدر الطلب غير مسموح به.' },
        { status: 403 }
      )
    }
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
    response.headers.set('Cache-Control', 'private, no-cache, must-revalidate')
  }

  response.headers.set('X-DNS-Prefetch-Control', 'on')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin')

  // 🔒 Security Headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  const isDev = process.env.NODE_ENV !== 'production'
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
  response.headers.set('Content-Security-Policy', cspDirectives)

  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|uploads|fonts|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.ico|.*\\.webp|.*\\.ttf|.*\\.woff2?).*)',
  ]
}
