/**
 * Record what actually happened to outbound mail.
 *
 * Several senders in this application are deliberately quiet about failure.
 * Password reset answers identically whether or not an address has an account
 * - it has to, or the reply would reveal who is a customer - so a send that
 * Resend refuses looks exactly like a send that worked. The only record was a
 * console.error, which means an administrator watching the console sees
 * silence and no reason for it.
 *
 * This writes the last outcome onto the MailSetting row so the admin console
 * can say "the hostmattic.com domain is not verified" instead of nothing.
 *
 * It must never affect whether mail is sent: every failure here is swallowed.
 * A settings row that cannot be written is a reporting problem, not a reason
 * to drop someone's receipt.
 */

import { prisma } from '@/lib/prisma';
import { MAIL_SETTING_ID } from '@/lib/email/mailConfig';

/** Long provider errors are truncated; the useful part is at the front. */
const MAX_ERROR = 500;

/**
 * A successful send is written at most this often. Recording every one would
 * add a database write to every email for a field whose only job is to show
 * roughly when mail last worked.
 */
const SUCCESS_THROTTLE_MS = 5 * 60 * 1000;

let lastSuccessWrite = 0;
/** Forces the next success through, so a recovery clears the alarm at once. */
let failureOutstanding = false;

export async function recordSendOutcome(
  ok: boolean,
  recipients: string[],
  error?: string
): Promise<void> {
  try {
    if (ok) {
      const now = Date.now();
      if (!failureOutstanding && now - lastSuccessWrite < SUCCESS_THROTTLE_MS) return;
      lastSuccessWrite = now;

      // Clear the previous failure: leaving it would have the console
      // reporting a fault that has since been fixed.
      await prisma.mailSetting.updateMany({
        where: { id: MAIL_SETTING_ID },
        data: {
          lastSendOkAt: new Date(),
          ...(failureOutstanding
            ? { lastSendError: null, lastSendErrorAt: null, lastSendErrorTo: null }
            : {}),
        },
      });
      failureOutstanding = false;
      return;
    }

    failureOutstanding = true;
    // updateMany, not update: on a deployment still running from the
    // RESEND_API_KEY environment fallback there is no row, and a missing row
    // must not throw inside a send.
    await prisma.mailSetting.updateMany({
      where: { id: MAIL_SETTING_ID },
      data: {
        lastSendErrorAt: new Date(),
        lastSendError: String(error || 'Unknown error').slice(0, MAX_ERROR),
        lastSendErrorTo: (recipients[0] || '').slice(0, 320),
      },
    });
  } catch {
    // Reporting only. Never let this change whether mail went out.
  }
}
