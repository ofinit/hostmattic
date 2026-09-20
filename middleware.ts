import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware — Route-Level Authentication Guard
 *
 * Runs on Next.js Edge runtime.
 * Uses Web Crypto API (crypto.subtle) instead of Node.js jsonwebtoken
 * to ensure 100% Edge compatibility without crashing or returning false 401s.
 */

// Routes that do NOT require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/health',
  '/api/domains',           // Public domain search/availability
  '/api/tax',               // Public tax rate lookup
  '/api/og',                // Open Graph image generation
  '/api/payments/instamojo/callback', // Instamojo redirect callback (no cookie on redirect)
];

// Routes that require ADMIN role
const ADMIN_ROUTES_PREFIX = '/api/admin';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'hostmattic_secure_jwt_prod_fallback_token_2026';
}

interface EdgeSession {
  id: string;
  email: string;
  name: string;
  role: string;
  exp?: number;
}

/**
 * Verifies JWT signature using native Web Crypto API (HMAC SHA-256).
 * Fully compatible with Next.js Edge runtime without Node.js crypto module dependencies.
 */
async function verifyJwtEdge(token: string): Promise<EdgeSession | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;

    const secret = getJwtSecret();
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    // Base64Url decode signature
    const sigStr = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const rawSig = Uint8Array.from(atob(sigStr), (c) => c.charCodeAt(0));
    const data = enc.encode(`${headerB64}.${payloadB64}`);
    const isValid = await crypto.subtle.verify('HMAC', key, rawSig, data);
    if (!isValid) return null;

    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as EdgeSession;

    // Check expiration if present
    if (payload.exp && Date.now() >= payload.exp * 1000) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
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

  const session = await verifyJwtEdge(token);
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
