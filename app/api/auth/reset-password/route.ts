import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { checkResetToken, redeemResetToken } from '@/lib/security/passwordReset';
import { rateLimit, clientIp } from '@/lib/security/signupGuard';

export const dynamic = 'force-dynamic';

/**
 * The other half of the reset, which previously did not exist at all: the old
 * forgot-password route emailed a token that no route could redeem.
 */

/** Masks an address enough to confirm the right account without publishing it. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/**
 * GET /api/auth/reset-password?token=...
 *
 * Lets the page say "this link has expired" before someone types a new
 * password, rather than after.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';

  const limit = rateLimit(`reset-check:${clientIp(req)}`, 30, 15 * 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json({ success: false, error: 'Too many attempts.' }, { status: 429 });
  }

  try {
    const check = await checkResetToken(token);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, reason: check.reason, error: check.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      scope: check.scope,
      // Masked: the link may be sitting in a shared inbox or a browser
      // history, and the full address does not need to be in either.
      email: maskEmail(check.email),
      name: check.name,
    });
  } catch (error: any) {
    console.error('[Reset Password] check failed:', error?.message);
    return NextResponse.json(
      { success: false, error: 'Could not check this reset link.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/reset-password  { token, password }
 *
 * Sets the new password and burns the token. No session is issued: after a
 * reset the person signs in normally, which proves the new password works and
 * means a stolen link cannot be turned straight into a logged-in session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token || '');
    const password = String(body?.password || '');

    const limit = rateLimit(`reset-submit:${clientIp(req)}`, 10, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 }
      );
    }

    // Same minimum as registration. A reset must not be a way around the
    // policy the sign-up form enforces.
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const check = await checkResetToken(token);
    if (!check.ok) {
      return NextResponse.json(
        { success: false, reason: check.reason, error: check.message },
        { status: 400 }
      );
    }

    const newHash = await hashPassword(password);
    const redeemed = await redeemResetToken(token, newHash);

    if (!redeemed.ok) {
      return NextResponse.json({ success: false, error: redeemed.message }, { status: 400 });
    }

    console.log(`[Reset Password] Password changed for user ${redeemed.userId} (scope ${redeemed.scope})`);

    return NextResponse.json({
      success: true,
      scope: redeemed.scope,
      // Where to send them next. An administrator who reset from the admin
      // login should land back there, not on the customer login.
      loginPath: redeemed.scope === 'ADMIN' ? '/admin/login' : '/login',
      message: 'Your password has been changed. You can now sign in with it.',
    });
  } catch (error: any) {
    console.error('[Reset Password] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Could not reset the password. Please try again.' },
      { status: 500 }
    );
  }
}
