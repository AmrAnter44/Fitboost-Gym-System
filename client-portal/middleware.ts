import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for protecting routes
 * Checks if member is authenticated before accessing protected pages
 */
export function middleware(request: NextRequest) {
  const token = request.cookies.get('member-token')?.value;
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/'];

  // Check if current path is public
  const isPublicPath = publicPaths.some((path) => pathname === path);

  // If trying to access protected route without token, redirect to login
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If logged in and trying to access login page, redirect to dashboard
  if (token && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, icons, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|workbox-.*\\.js).*)',
  ],
};
