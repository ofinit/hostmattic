/**
 * The one way out of this application for an email.
 *
 * Picks a transport from the configuration in the admin console (see
 * mailConfig.ts) and hands the message to it. Every caller in the codebase
 * imports sendEmail; none of them should know or care which provider is in
 * use.
 *
 * The unconfigured case keeps the rule that was established for Resend: in
 * production, nothing sent is a FAILURE and is reported as one. It used to
 * return success in every environment, so a live deployment with no key told
 * checkout the receipt had gone out while the customer received nothing. Same
 * rule as the payment gateway - simulation is only allowed outside
 * production.
 */

import { getMailConfig } from '@/lib/email/mailConfig';
import { sendViaSmtp } from '@/lib/email/providers/smtpTransport';
import { sendViaResend } from '@/lib/email/providers/resendTransport';
import { recordSendOutcome } from '@/lib/email/sendLog';
import type { EmailPayload, EmailResult } from '@/lib/email/types';

export type { EmailPayload, EmailResult } from '@/lib/email/types';

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
  const cfg = await getMailConfig();

  if (cfg.provider === 'NONE') {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[Email] No mail provider is configured, so "${payload.subject}" was NOT sent to ` +
          `${recipients.join(', ')}. Transactional email is down.` +
          (cfg.problem ? ` Reason: ${cfg.problem}` : '')
      );
      return {
        success: false,
        provider: 'NONE',
        error: cfg.problem || 'Email delivery is not configured on this deployment.',
      };
    }

    const simId = 'sim_' + Math.random().toString(36).substring(2, 11);
    console.log(
      `[Email: Simulated] To: ${recipients.join(', ')} | Subject: "${payload.subject}" | ID: ${simId}`
    );
    return { success: true, id: simId, simulated: true, provider: 'NONE' };
  }

  const result =
    cfg.provider === 'SMTP' && cfg.smtp
      ? await sendViaSmtp(payload, cfg.smtp, cfg.from, cfg.replyTo)
      : await sendViaResend(payload, cfg.resendApiKey, cfg.from, cfg.replyTo);

  // Several senders are deliberately quiet about failure - password reset has
  // to answer the same way whether or not the address has an account - so
  // without this the only record of a refusal is a console line. Reporting
  // only: it cannot change what was just sent, and it swallows its own errors.
  await recordSendOutcome(result.success, recipients, result.error);

  return result;
}
