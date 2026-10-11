import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  comparePassword,
  hashPassword,
  requireAdmin,
  signToken,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * GET /api/admin/account
 * Returns the signed-in administrator's own account details.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, updatedAt: true },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Account not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, account: user });
}

/**
 * POST /api/admin/account
 * Changes the signed-in administrator's own email and/or password.
 *
 * The current password is always required: a session cookie alone must not be
 * enough to take over the account. Nothing here consults ADMIN_PASSWORD - the
 * stored hash is the only authority, and this is the supported way to rotate it
 * from the UI (the CLI equivalent is `npm run admin:password`).
 */
export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json();
    const currentPassword: string = (body?.currentPassword || '').toString();
    const newEmail: string = (body?.newEmail || '').toString().toLowerCase().trim();
    const newPassword: string = (body?.newPassword || '').toString();
    const confirmPassword: string = (body?.confirmPassword || '').toString();
    const newName: string = (body?.newName || '').toString().trim();

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, error: 'Enter your current password to confirm this change.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Account not found.' },
        { status: 404 }
      );
    }

    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect.' },
        { status: 401 }
      );
    }

    const data: Record<string, unknown> = {};
    const changed: string[] = [];

    // --- Email -------------------------------------------------------------
    if (newEmail && newEmail !== user.email.toLowerCase()) {
      if (!EMAIL_RE.test(newEmail)) {
        return NextResponse.json(
          { success: false, error: 'That does not look like a valid email address.' },
          { status: 400 }
        );
      }
      const taken = await prisma.user.findUnique({ where: { email: newEmail } });
      if (taken && taken.id !== user.id) {
        return NextResponse.json(
          { success: false, error: 'Another account already uses that email address.' },
          { status: 409 }
        );
      }
      data.email = newEmail;
      changed.push('email');
    }

    // --- Password ----------------------------------------------------------
    if (newPassword) {
      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: 'The two new passwords do not match.' },
          { status: 400 }
        );
      }
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `Use at least ${MIN_PASSWORD_LENGTH} characters. Yours is ${newPassword.length}.`,
          },
          { status: 400 }
        );
      }
      if (newPassword === currentPassword) {
        return NextResponse.json(
          { success: false, error: 'The new password must differ from the current one.' },
          { status: 400 }
        );
      }
      data.passwordHash = await hashPassword(newPassword);
      changed.push('password');
    }

    // --- Display name ------------------------------------------------------
    if (newName && newName !== user.name) {
      data.name = newName;
      changed.push('name');
    }

    if (changed.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nothing to change.' },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });

    // The email is carried in the JWT, so re-issue the cookie rather than
    // leaving the session pointing at a stale identity.
    const response = NextResponse.json({
      success: true,
      changed,
      account: updated,
      message: `Updated ${changed.join(' and ')}.`,
    });

    response.cookies.set(
      'hm_auth_token',
      signToken({
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24,
        path: '/',
      }
    );

    console.log(`[Hostmattic] Administrator ${user.email} updated: ${changed.join(', ')}`);
    return response;
  } catch (error: any) {
    console.error('Admin account update error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not update the account.' },
      { status: 500 }
    );
  }
}
