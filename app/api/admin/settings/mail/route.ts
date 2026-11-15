import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { encryptSecret, isEncryptionAvailable, secretLast4 } from '@/lib/crypto/secrets';
import {
  MAIL_SETTING_ID,
  getMailConfig,
  invalidateMailConfig,
  formatFrom,
} from '@/lib/email/mailConfig';
import { checkResendDomain } from '@/lib/email/resendDomains';
import { verifySmtp, resetTransport } from '@/lib/email/providers/smtpTransport';
import { sendEmail } from '@/lib/email/send';
import { renderEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

const PROVIDERS = ['NONE', 'SMTP', 'RESEND'] as const;
type Provider = (typeof PROVIDERS)[number];

/** A deliverable-looking address. Not a validator, a typo catcher. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

async function readRow() {
  try {
    return await prisma.mailSetting.findUnique({ where: { id: MAIL_SETTING_ID } });
  } catch (err: any) {
    console.warn('[Mail settings] read failed:', err?.message);
    return null;
  }
}

/**
 * GET /api/admin/settings/mail
 *
 * The password is never returned - only whether one is stored and its last
 * four characters, which is enough to confirm which credential is installed
 * without the value leaving the server. Same rule as the payment gateways.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const row = await readRow();
    const effective = await getMailConfig();

    return NextResponse.json({
      success: true,
      encryptionAvailable: isEncryptionAvailable(),
      resendEnvKeyPresent: Boolean((process.env.RESEND_API_KEY || '').trim()),
      settings: {
        provider: (row?.provider as Provider) || 'NONE',
        host: row?.host ?? '',
        port: row?.port ?? 587,
        secure: row?.secure ?? false,
        username: row?.username ?? '',
        hasPassword: Boolean(row?.passwordCipher),
        passwordLast4: row?.passwordLast4 ?? '',
        allowInvalidCert: row?.allowInvalidCert ?? false,
        fromName: row?.fromName ?? 'Hostmattic',
        fromEmail: row?.fromEmail ?? '',
        replyTo: row?.replyTo ?? '',
        lastTestAt: row?.lastTestAt ?? null,
        lastTestOk: row?.lastTestOk ?? null,
        lastTestError: row?.lastTestError ?? null,
        lastTestTo: row?.lastTestTo ?? null,
        // What real outbound mail did, which the test button cannot tell you:
        // the test always goes to the administrator's own address.
        lastSendOkAt: row?.lastSendOkAt ?? null,
        lastSendErrorAt: row?.lastSendErrorAt ?? null,
        lastSendError: row?.lastSendError ?? null,
        lastSendErrorTo: row?.lastSendErrorTo ?? null,
        updatedAt: row?.updatedAt ?? null,
        updatedBy: row?.updatedBy ?? null,
      },
      // What the application is ACTUALLY using right now, which is not always
      // what the row says - an environment fallback or an unreadable password
      // both change the answer.
      effective: {
        provider: effective.provider,
        source: effective.source,
        from: effective.from,
        problem: effective.problem ?? null,
      },
      // Ask Resend whether it will actually send from this address. The test
      // button cannot answer this: it goes to the administrator's own address,
      // which on an unverified account is the one address that still works, so
      // it passes while every customer email is refused with a 403.
      resendDomain:
        effective.provider === 'RESEND'
          ? await checkResendDomain(effective.resendApiKey, effective.from)
          : null,
      // Where the test message will go. Fixed to the signed-in administrator:
      // an arbitrary recipient would make this an open relay.
      testRecipient: session.email,
    });
  } catch (error: any) {
    console.error('Mail settings read error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not read mail settings.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/settings/mail
 * { provider, host, port, secure, username, password?, allowInvalidCert,
 *   fromName, fromEmail, replyTo }
 *
 * `password` is optional: omitting it keeps the stored one, so the From
 * address or the port can be changed without re-entering the credential.
 */
export async function POST(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  try {
    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider || 'NONE').toUpperCase() as Provider;

    if (!PROVIDERS.includes(provider)) {
      return NextResponse.json({ success: false, error: 'Unknown mail provider.' }, { status: 400 });
    }

    const host = String(body?.host || '').trim();
    const port = Number.parseInt(String(body?.port ?? '587'), 10);
    const secure = body?.secure === true;
    const username = String(body?.username || '').trim();
    const password = typeof body?.password === 'string' ? body.password : '';
    const allowInvalidCert = body?.allowInvalidCert === true;
    const fromName = String(body?.fromName || '').trim();
    const fromEmail = String(body?.fromEmail || '').trim();
    const replyTo = String(body?.replyTo || '').trim();

    const existing = await readRow();

    if (provider === 'SMTP') {
      if (!host) {
        return NextResponse.json({ success: false, error: 'An SMTP host is required.' }, { status: 400 });
      }
      if (!Number.isFinite(port) || port < 1 || port > 65535) {
        return NextResponse.json(
          { success: false, error: 'The port must be a number between 1 and 65535.' },
          { status: 400 }
        );
      }
      if (!fromEmail || !looksLikeEmail(fromEmail)) {
        return NextResponse.json(
          { success: false, error: 'A valid From address is required.' },
          { status: 400 }
        );
      }
      if (replyTo && !looksLikeEmail(replyTo)) {
        return NextResponse.json(
          { success: false, error: 'The Reply-To address does not look like an email address.' },
          { status: 400 }
        );
      }
      if (!password && !existing?.passwordCipher) {
        return NextResponse.json(
          { success: false, error: 'An SMTP password is required.' },
          { status: 400 }
        );
      }
      if (password && !isEncryptionAvailable()) {
        return NextResponse.json(
          {
            success: false,
            error:
              'SETTINGS_ENCRYPTION_KEY is not set on this deployment, so the SMTP password cannot ' +
              'be stored safely. Generate one with "openssl rand -hex 32" and add it before saving.',
          },
          { status: 400 }
        );
      }
      // A common and silent misconfiguration: 465 is implicit TLS, 587 is
      // STARTTLS. Getting it backwards produces a connection that hangs until
      // it times out, which looks like a firewall problem.
      if (port === 465 && !secure) {
        return NextResponse.json(
          {
            success: false,
            error: 'Port 465 requires implicit TLS. Turn on "Use TLS", or use port 587 instead.',
          },
          { status: 400 }
        );
      }
      if (port === 587 && secure) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Port 587 uses STARTTLS, which is negotiated automatically. Turn off "Use TLS", ' +
              'or use port 465 instead.',
          },
          { status: 400 }
        );
      }
    }

    if (provider === 'RESEND' && !(process.env.RESEND_API_KEY || '').trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            'RESEND_API_KEY is not set in this environment, so Resend cannot send. Set it in the ' +
            'deployment, or choose SMTP.',
        },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {
      provider,
      host,
      port: Number.isFinite(port) ? port : 587,
      secure,
      username,
      allowInvalidCert,
      fromName: fromName || 'Hostmattic',
      fromEmail,
      replyTo,
      updatedBy: session.email,
    };

    if (password) {
      data.passwordCipher = encryptSecret(password);
      data.passwordLast4 = secretLast4(password);
    }

    await prisma.mailSetting.upsert({
      where: { id: MAIL_SETTING_ID },
      update: data,
      create: {
        id: MAIL_SETTING_ID,
        ...(data as any),
        passwordCipher: password ? encryptSecret(password) : '',
        passwordLast4: password ? secretLast4(password) : '',
      },
    });

    // Take effect at once rather than after the cache expires, and drop any
    // pooled connection authenticated with the previous credentials.
    invalidateMailConfig();
    resetTransport();

    console.log(
      `[Hostmattic] MAIL provider set to ${provider} by ${session.email}` +
        (password ? ' (password updated)' : '')
    );

    const effective = await getMailConfig();

    return NextResponse.json({
      success: true,
      message:
        provider === 'NONE'
          ? 'Transactional email is now turned off.'
          : `Mail configured to use ${provider}. Send a test message to confirm it works.`,
      effective: {
        provider: effective.provider,
        source: effective.source,
        from: effective.from,
        problem: effective.problem ?? null,
      },
    });
  } catch (error: any) {
    console.error('Mail settings write error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not save mail settings.' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/settings/mail  - send a test message.
 *
 * The recipient is ALWAYS the signed-in administrator's own address. Letting
 * the caller name one would turn this into an open relay backed by our
 * sending reputation, which is the fault that was found on
 * /api/notifications/email.
 */
export async function PUT(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  const to = session.email;

  try {
    const cfg = await getMailConfig();

    if (cfg.provider === 'NONE') {
      return NextResponse.json(
        {
          success: false,
          error: cfg.problem || 'No mail provider is configured, so there is nothing to test.',
        },
        { status: 400 }
      );
    }

    // For SMTP, check the connection and credentials FIRST. Otherwise a wrong
    // password is reported as "could not send", which sends an administrator
    // looking in the wrong place.
    if (cfg.provider === 'SMTP' && cfg.smtp) {
      const check = await verifySmtp(cfg.smtp);
      if (!check.ok) {
        await recordTest(session.email, to, false, check.error || 'SMTP verification failed.');
        return NextResponse.json({ success: false, stage: 'connect', error: check.error }, { status: 400 });
      }
    }

    const html = renderEmail(
      `
        <h2 style="margin:0 0 12px;color:#0F172A;">Mail is working</h2>
        <p>This is a test message from the Hostmattic admin console.</p>
        <p>It was sent via <strong>${cfg.provider}</strong>${
          cfg.source === 'environment' ? ' (credentials from the environment)' : ''
        } and addressed to ${to}.</p>
        <p style="color:#64748B;font-size:13px;">
          If you can read this, password resets, receipts and renewal reminders can reach customers.
        </p>
      `,
      'Hostmattic mail configuration test'
    );

    const result = await sendEmail({
      to,
      subject: 'Hostmattic: mail configuration test',
      html,
      text: `Mail is working. Sent via ${cfg.provider} to ${to}.`,
    });

    await recordTest(session.email, to, result.success, result.error || null);

    if (!result.success) {
      return NextResponse.json({ success: false, stage: 'send', error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Test message sent to ${to} via ${cfg.provider}. If it does not arrive, check the spam folder and the sending domain's SPF and DKIM records.`,
      provider: result.provider,
      id: result.id ?? null,
      simulated: result.simulated ?? false,
    });
  } catch (error: any) {
    console.error('Mail test error:', error);
    await recordTest(session.email, to, false, error?.message || 'Unknown error').catch(() => {});
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not send the test message.' },
      { status: 500 }
    );
  }
}

/** Records the outcome so the console can show whether mail has ever worked. */
async function recordTest(by: string, to: string, ok: boolean, error: string | null) {
  try {
    await prisma.mailSetting.upsert({
      where: { id: MAIL_SETTING_ID },
      update: { lastTestAt: new Date(), lastTestOk: ok, lastTestError: error, lastTestTo: to },
      create: {
        id: MAIL_SETTING_ID,
        lastTestAt: new Date(),
        lastTestOk: ok,
        lastTestError: error,
        lastTestTo: to,
        updatedBy: by,
      },
    });
  } catch (err: any) {
    console.warn('[Mail settings] could not record test result:', err?.message);
  }
}
