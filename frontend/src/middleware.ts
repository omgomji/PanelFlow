/**
 * Next.js Edge Middleware — Route Protection
 *
 * Checks for the PRESENCE of the `token` cookie and redirects to /login
 * if it is missing from protected admin routes.
 *
 * NOTE: This does NOT verify the JWT signature — Next.js Edge middleware
 * cannot run `jsonwebtoken` (it needs Node.js APIs unavailable on the Edge
 * runtime). JWT signature verification remains solely with Express, which
 * rejects invalid/expired tokens with 401. This middleware is a UX nicety
 * (prevents a flash of protected content), not the real security boundary.
 */
import { NextRequest, NextResponse } from 'next/server';



export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;



  // Determine if path needs auth (admin shell paths)
  const isAdminPath =
    pathname === '/' ||
    pathname.startsWith('/event-types') ||
    pathname.startsWith('/availability') ||
    pathname.startsWith('/meetings') ||
    pathname.startsWith('/scheduled-events') ||
    pathname.startsWith('/contacts') ||
    pathname.startsWith('/positions');

  if (!isAdminPath) {
    return NextResponse.next();
  }

  // Check for the frontend-specific isLoggedIn cookie
  const isLoggedIn = req.cookies.get('isLoggedIn');

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
