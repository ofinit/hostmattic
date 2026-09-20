import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

/**
 * Next.js Middleware — Route-Level Authentication Guard
 *
 * This provides defense-in-depth alongside per-route requireAuth/requireAdmin checks.
 * Routes not in the public whitelist require a valid JWT session cookie.
 * Admin routes additionally require the ADMIN role.
 */

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/health',
  '/api/domains',           // Public domain search/availability
  '/api/tax',               // Public tax rate lookup
  '/api/og',                // Open Graph image generation
  '/api/payments/instamojo/callback', // Instamojo redirect callback (no cookie on redirect)
];

// Routes that require ADMIN role
const ADMIN_ROUTES_PREFIX = '/api/admin';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for auth token
  const token = req.cookies.get('hm_auth_token')?.value;
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required. Please log in.' },
      { status: 401 }
    );
  }

  const session = verifyToken(token);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired session. Please log in again.' },
      { status: 401 }
    );
  }

  // Admin routes require ADMIN role
  if (pathname.startsWith(ADMIN_ROUTES_PREFIX) && session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. Admin access required.' },
      { status: 403 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
