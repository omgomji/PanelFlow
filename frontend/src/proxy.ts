/**
 * Next.js Edge Middleware — Route Protection
 *
 * Authentication is handled by AuthProvider and the backend. The backend's
 * httpOnly accessToken cookie belongs to the API domain, so it is not visible
 * to Vercel's middleware domain and cannot be used for frontend redirects.
 */
import { NextRequest, NextResponse } from 'next/server';



export default function proxy(req: NextRequest) {
  void req;
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
