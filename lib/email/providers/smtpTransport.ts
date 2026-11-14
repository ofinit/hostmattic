/**
 * SMTP delivery via nodemailer.
 *
 * The transport is cached per credential set: creating one per message would
 * open a new TCP + TLS connection for every email, and nodemailer's pool
 * exists precisely to avoid that. The cache key deliberately includes the
 * password, so rotating it builds a new transport rather than silently
 * reusing a connection authenticated with the old one.
 */

import nodemailer, { Transporter } from 'nodemailer';
import type { SmtpCredentials } from '@/lib/email/mailConfig';
import type { EmailPayload, EmailResult } from '@/lib/email/types';
import { describeSmtpError } from '@/lib/email/smtpErrors';

export { describeSmtpError };

let cached: { key: string; transport: Transporter } | null = null;

function cacheKey(c: SmtpCredentials): string {
  return [c.host, c.port, c.secure, c.username, c.password, c.allowInvalidCert].join('\u0000');
}

export function buildTransport(c: SmtpCredentials): Transporter {
  const key = cacheKey(c);
  if (cached && cached.key === key) return cached.transport;

  if (cached) {
    // Credentials changed. Close the old pool rather than leaking its sockets.
    try {
      cached.transport.close();
    } catch {
      /* closing a dead pool is not an error worth reporting */
    }
  }

  const transport = nodemailer.createTransport({
    host: c.host,
    port: c.port,
    // Implicit TLS on 465; on 587 nodemailer issues STARTTLS itself.
    secure: c.secure,
    auth: c.username ? { user: c.username, pass: c.password } : undefined,
    pool: true,
    maxConnections: 3,
    // A mail server that never answers must not hold a checkout request open.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: c.allowInvalidCert
      ? // Only when an administrator has explicitly accepted it. The console
        // labels this as the downgrade it is: it disables the check that the
        // certificate belongs to the server being talked to.
        { rejectUnauthorized: false }
      : undefined,
  });

  cached = { key, transport };
  return transport;
}

/** Drops the cached pool. Called when settings are saved. */
export function resetTransport(): void {
  if (cached) {
    try {
      cached.transport.close();
    } catch {
      /* as above */
    }
  }
  cached = null;
}

/**
 * Checks the server answers and accepts the credentials, without sending.
 * Used by the admin console's test button before it tries a real message, so
 * a wrong password is reported as a wrong password rather than as a failed
 * delivery.
 */
export async function verifySmtp(c: SmtpCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    await buildTransport(c).verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: describeSmtpError(err) };
  }
}

export async function sendViaSmtp(
  payload: EmailPayload,
  c: SmtpCredentials,
  from: string,
  replyTo: string
): Promise<EmailResult> {
  try {
    const info = await buildTransport(c).sendMail({
      from: payload.from || from,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || undefined,
      replyTo: payload.replyTo || replyTo || undefined,
    });

    // A 2xx from the server is an acceptance for relay, not proof of delivery.
    // `rejected` lists recipients the server refused outright; treating that
    // as success is how a bounce becomes invisible.
    if (info.rejected && info.rejected.length) {
      return {
        success: false,
        provider: 'SMTP',
        error: `The mail server refused: ${info.rejected.join(', ')}`,
      };
    }

    return { success: true, id: info.messageId, provider: 'SMTP', simulated: false };
  } catch (err: any) {
    console.error('[SMTP] Send failed:', err?.message);
    return { success: false, provider: 'SMTP', error: describeSmtpError(err) };
  }
}
