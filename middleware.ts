import { NextRequest, NextResponse } from 'next/server';
import {
  isLegacyPhp,
  isUpstreamCallback,
  resolveLegacyTarget,
} from '@/lib/legacySupersite';

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
  '/api/auth/end-impersonation', // caller holds a CUSTOMER session; authority is the stashed admin cookie
  '/api/health',
  '/api/domains',           // Public domain search/availability
  '/api/tax',               // Public tax rate lookup
  '/api/og',                // Open Graph image generation
  '/api/payments/instamojo/callback', // Instamojo redirect callback (no cookie on redirect)
];

// Routes that require ADMIN role
const ADMIN_ROUTES_PREFIX = '/api/admin';

/**
 * Page routes that must not render to an unauthenticated visitor.
 *
 * These were previously unguarded: the matcher only covered /api/ and .php, so
 * anyone could open /client/dashboard and get the whole portal shell rendered
 * ("Welcome back, Valued Customer!") with the signed-out header still showing
 * Client Login / Sign Up. The data was safe because the APIs return 401, but
 * the console should never paint for someone who is not signed in.
 *
 * Guarding here rather than in the page means no flash of protected UI and no
 * reliance on client-side JavaScript.
 */
const PROTECTED_PAGE_PREFIXES = ['/client', '/admin'];

/** Pages under those prefixes that must stay reachable while signed out. */
const PAGE_AUTH_EXCEPTIONS = ['/admin/login'];

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
  const { pathname, searchParams } = req.nextUrl;

  // ---- Legacy SuperSite (.php) URLs -------------------------------------
  // The upstream customer panel still links here for buy / transfer / renew
  // flows. Those paths were removed with the old PHP storefront, so without
  // this every one of them dead-ends on a 404.
  if (isLegacyPhp(pathname)) {
    const origin = (process.env.LEGACY_SUPERSITE_ORIGIN || '').trim().replace(/\/$/, '');

    // A one-time token plus a validate/verify action can only be completed by
    // the upstream platform; nothing here can honour it.
    if (origin && isUpstreamCallback(pathname, searchParams)) {
      const upstream = new URL(pathname + req.nextUrl.search, origin);
      console.log('[Legacy] upstream callback ->', pathname, searchParams.toString().slice(0, 80));
      return NextResponse.redirect(upstream, 307);
    }

    const target = resolveLegacyTarget(pathname, searchParams);
    console.log(
      '[Legacy] ' + pathname + ' p=' + (searchParams.get('p') || '-') +
      ' action=' + (searchParams.get('action') || '-') + ' -> ' + target
    );
    return NextResponse.redirect(new URL(target, req.nextUrl.origin), 308);
  }

  // ---- Protected page routes --------------------------------------------
  if (!pathname.startsWith('/api/')) {
    const needsAuth =
      PROTECTED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
      !PAGE_AUTH_EXCEPTIONS.some((p) => pathname === p || pathname.startsWith(p + '/'));

    if (!needsAuth) return NextResponse.next();

    const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
    const signInPath = isAdminArea ? '/admin/login' : '/login';

    const pageToken = req.cookies.get('hm_auth_token')?.value;
    const pageSession = pageToken ? await verifyJwtEdge(pageToken) : null;

    if (!pageSession || (isAdminArea && pageSession.role !== 'ADMIN')) {
      const url = req.nextUrl.clone();
      url.pathname = signInPath;
      url.search = '';
      // Come back here once signed in.
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

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
  // '/api/:path*' for the auth guard, plus every legacy .php path.
  matcher: ['/api/:path*', '/(.*\.php)', '/client/:path*', '/admin/:path*'],
};
