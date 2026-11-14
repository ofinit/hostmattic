import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail, generatePasswordResetEmail } from '@/lib/email/resend';
import { issueResetToken, RESET_TTL_MINUTES, ResetScope } from '@/lib/security/passwordReset';
import { rateLimit, clientIp } from '@/lib/security/signupGuard';
import { isMailConfigured } from '@/lib/email/mailConfig';

export const dynamic = 'force-dynamic';

/**
 * Start a password reset.
 *
 * This used to generate a token, put it in a link, email it, and store
 * nothing - no route read it back and the login page ignored the query
 * parameter, so the link did nothing. It now issues a real single-use grant
 * (see lib/security/passwordReset).
 *
 * Two behaviours are deliberate:
 *
 *  - The reply is the same whether or not the address has an account, so this
 *    cannot be used to find out who is a customer.
 *  - If no mail provider is configured, it answers 503 instead. That leaks
 *    nothing, because it is true of every address equally, and it is better
 *    than telling someone a link is on its way when nothing can send it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body?.email;
    const scope: ResetScope = String(body?.scope || '').toUpperCase() === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = clientIp(req);

    // Reset mail is free to send and goes to an address the requester does not
    // control, so an unlimited endpoint is a way to flood someone's inbox.
    const limit = rateLimit(`forgot:${ip}`, 5, 15 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json(
        { success: false, error: 'Too many reset requests. Try again in a few minutes.' },
        { status: 429 }
      );
    }

    if (!(await isMailConfigured())) {
      console.error('[Forgot Password] No mail provider configured; cannot send a reset link.');
      return NextResponse.json(
        {
          success: false,
          error:
            'Password reset is temporarily unavailable because email delivery is not configured. ' +
            'Please contact support.',
        },
        { status: 503 }
      );
    }

    let user: { id: string; email: string; name: string; role: string; emailStatus: string } | null = null;
    try {
      user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true, name: true, role: true, emailStatus: true },
      });
    } catch (dbErr: any) {
      console.error('[Forgot Password] DB lookup failed:', dbErr?.message);
      return NextResponse.json(
        { success: false, error: 'Could not process the request. Please try again.' },
        { status: 500 }
      );
    }

    const neutral = NextResponse.json({
      success: true,
      message:
        `If an account exists for ${normalizedEmail}, a password reset link is on its way. ` +
        `The link is valid for ${RESET_TTL_MINUTES} minutes. Check the spam folder if it does not arrive.`,
    });

    if (!user) {
      console.log(`[Forgot Password] No account for ${normalizedEmail} (answered neutrally)`);
      return neutral;
    }

    // Sending to an address that has already hard-bounced burns the sending
    // domain's reputation and will not reach anyone. The answer stays neutral.
    if (user.emailStatus && user.emailStatus !== 'OK') {
      console.warn(
        `[Forgot Password] ${normalizedEmail} is ${user.emailStatus}; not sending. ` +
          'This account needs a reset by an administrator.'
      );
      return neutral;
    }

    // The scope only decides which login page the link returns to. Authority
    // comes from the user's own role, never from the request - asking for
    // ADMIN scope on a customer account gets a customer link.
    const effectiveScope: ResetScope = user.role === 'ADMIN' ? scope : 'CUSTOMER';

    const { token } = await issueResetToken(user.id, effectiveScope, ip);

    const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://hostmattic.com').replace(/\/+$/, '');
    const resetUrl = `${base}/reset-password?token=${token}`;

    const content = generatePasswordResetEmail({
      customerName: user.name || 'there',
      resetUrl,
    });

    const sent = await sendEmail({
      to: normalizedEmail,
      subject: content.subject,
      html: content.html,
    });

    if (!sent.success) {
      // Deliberately still neutral. Answering differently here would undo the
      // whole point of the neutral reply: a 502 would mean "this address has
      // an account" and a 200 would mean it does not, which is exactly the
      // enumeration this endpoint is shaped to prevent.
      //
      // The honesty this costs is bounded. A provider that is down or
      // misconfigured is caught by the isMailConfigured() check above and
      // answered 503 for every address alike; what reaches here is a
      // per-recipient refusal, which is rare and is logged loudly for whoever
      // is on support. The admin console shows mail health directly.
      console.error(
        `[Forgot Password] Grant issued for ${normalizedEmail} but the email FAILED: ${sent.error}. ` +
          'This person is waiting for a link that did not send.'
      );
      return neutral;
    }

    console.log(
      `[Forgot Password] Reset link sent to ${normalizedEmail} (scope ${effectiveScope}, via ${sent.provider})`
    );
    return neutral;
  } catch (error: any) {
    console.error('[Forgot Password] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process password reset request. Please try again later.' },
      { status: 500 }
    );
  }
}
