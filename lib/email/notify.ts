/**
 * Delivering operational alerts to whoever runs this.
 *
 * Staff addresses come from the database rather than an environment variable,
 * because administrator credentials already live there and splitting the two
 * means one can drift out of step with the other.
 */

import { prisma } from '@/lib/prisma';
import { sendEmail } from './resend';

/** Every administrator account, or the override if one is configured. */
export async function adminRecipients(): Promise<string[]> {
  const override = process.env.ADMIN_ALERT_EMAIL?.trim();
  if (override) return override.split(',').map((e) => e.trim()).filter(Boolean);

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { email: true },
    });
    return admins.map((a) => a.email).filter(Boolean);
  } catch (err: any) {
    console.error('[Notify] Could not resolve administrator recipients:', err?.message);
    return [];
  }
}

/**
 * Sends an alert to staff. Never throws: an alert that fails must not take
 * down the operation it was reporting on - but it is logged loudly, because a
 * silent alerting system is worse than none.
 */
export async function notifyAdmins(content: { subject: string; html: string }): Promise<void> {
  try {
    const to = await adminRecipients();
    if (!to.length) {
      console.error(`[Notify] No administrator address to send "${content.subject}" to.`);
      return;
    }

    const result = await sendEmail({ to, subject: content.subject, html: content.html });
    if (!result.success) {
      console.error(`[Notify] Alert "${content.subject}" was not delivered: ${result.error}`);
    }
  } catch (err: any) {
    console.error(`[Notify] Alert "${content.subject}" threw:`, err?.message);
  }
}
