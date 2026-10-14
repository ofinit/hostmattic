import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'hm_auth_token';
const ADMIN_BACKUP_COOKIE = 'hm_admin_token';

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  };
}

/**
 * POST /api/auth/end-impersonation
 *
 * Ends an administrator's "view as customer" session and hands back their own.
 *
 * This deliberately lives outside /api/admin/. The caller is holding a CUSTOMER
 * session at this point, so the admin role guard in middleware would reject it.
 * Authority comes instead from the stashed administrator cookie, which is
 * signature-verified and role-checked here before being restored - a customer
 * who never impersonated has no such cookie and simply gets a 400.
 */
export async function POST(req: NextRequest) {
  const backup = req.cookies.get(ADMIN_BACKUP_COOKIE)?.value;

  if (!backup) {
    return NextResponse.json(
      { success: false, error: 'No administrator session to return to.' },
      { status: 400 }
    );
  }

  const adminSession = verifyToken(backup);
  if (!adminSession || adminSession.role !== 'ADMIN') {
    const dead = NextResponse.json(
      { success: false, error: 'That administrator session has expired. Please sign in again.' },
      { status: 401 }
    );
    dead.cookies.set(ADMIN_BACKUP_COOKIE, '', cookieOptions(0));
    return dead;
  }

  const current = req.cookies.get(SESSION_COOKIE)?.value;
  const impersonated = current ? verifyToken(current) : null;

  const response = NextResponse.json({
    success: true,
    redirectTo: '/admin/dashboard',
    message: 'Returned to your administrator session.',
  });

  response.cookies.set(SESSION_COOKIE, backup, cookieOptions(60 * 60 * 24));
  response.cookies.set(ADMIN_BACKUP_COOKIE, '', cookieOptions(0));

  console.log(
    `[Hostmattic] IMPERSONATION END: ${adminSession.email} <- ${impersonated?.email || 'unknown'}`
  );

  return response;
}
