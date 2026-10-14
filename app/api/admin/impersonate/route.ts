import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, signToken, verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE = 'hm_auth_token';
const ADMIN_BACKUP_COOKIE = 'hm_admin_token';

/** Impersonation sessions are deliberately short. */
const IMPERSONATION_TTL = '45m';
const IMPERSONATION_MAX_AGE = 45 * 60;

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
 * POST /api/admin/impersonate   { customerId }
 *
 * Opens the Hostmattic client portal as a given customer, so support can see
 * exactly what the customer sees without asking for their password.
 *
 * The administrator's own session is stashed in a separate cookie and restored
 * by DELETE, so impersonating does not sign the admin out of the console.
 *
 * Guard rails:
 *  - administrators only, and never of another administrator
 *  - the issued token carries `impersonatedBy`, so every request is attributable
 *    and the portal shows a permanent banner
 *  - 45 minutes, against the usual 24 hours
 *  - both start and stop are logged
 */
export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json().catch(() => ({}));
    const customerId: string = (body?.customerId || '').toString().trim();

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: 'No customer specified.' },
        { status: 400 }
      );
    }

    const customer = await prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'That customer no longer exists.' },
        { status: 404 }
      );
    }

    if (customer.role === 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Administrator accounts cannot be impersonated.' },
        { status: 403 }
      );
    }

    if (customer.id === session.id) {
      return NextResponse.json(
        { success: false, error: 'That is your own account.' },
        { status: 400 }
      );
    }

    const adminToken = req.cookies.get(SESSION_COOKIE)?.value || '';

    const response = NextResponse.json({
      success: true,
      redirectTo: '/client/dashboard',
      customer: { id: customer.id, name: customer.name, email: customer.email },
      expiresInMinutes: 45,
      message: `Viewing the portal as ${customer.name}. Your administrator session is preserved.`,
    });

    // Keep the admin's own session so it can be handed back on exit.
    if (adminToken) {
      response.cookies.set(ADMIN_BACKUP_COOKIE, adminToken, cookieOptions(IMPERSONATION_MAX_AGE));
    }

    response.cookies.set(
      SESSION_COOKIE,
      signToken(
        {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          role: customer.role,
          impersonatedBy: session.email,
        },
        IMPERSONATION_TTL
      ),
      cookieOptions(IMPERSONATION_MAX_AGE)
    );

    console.log(
      `[Hostmattic] IMPERSONATION START: ${session.email} -> ${customer.email} (${customer.id})`
    );

    return response;
  } catch (error: any) {
    console.error('Impersonation error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not start the session.' },
      { status: 500 }
    );
  }
}
