import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { notifyAdmins } from '@/lib/email/notify';
import { generateRenewalReminderEmail, generateAdminLowBalanceEmail } from '@/lib/email/lifecycle';
import { getLiveDomainPricing } from '@/lib/api/pricing';
import { apiClient, isLiveApiConfigured } from '@/lib/api/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Daily reminder run.
 *
 * Driven by an external scheduler (Coolify cron, or any caller that can send
 * the shared secret) rather than a timer inside the app, because the app runs
 * as more than one container and a timer in each would email every customer
 * once per container.
 *
 * Authorised by CRON_SECRET in an Authorization header. It is not behind the
 * session guard because a scheduler has no session, and it is not public
 * because it sends mail.
 *
 * Reminders are logged per service per bucket, so running twice in a day - or
 * retrying after a partial failure - cannot email the same customer twice
 * about the same thing.
 */

/** Days before expiry at which a reminder goes out. 0 is the day itself. */
const DOMAIN_BUCKETS = [30, 14, 7, 1, 0];
const SERVICE_BUCKETS = [30, 14, 3, 0];

/** Alert staff below this much upstream balance. */
const LOW_BALANCE_THRESHOLD = Number(process.env.LOW_BALANCE_THRESHOLD_INR || 5000);

function daysUntil(date: Date, now: Date): number {
  const ms = new Date(date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0);
  return Math.round(ms / 86_400_000);
}

/** The bucket this many days out belongs to, or null if no reminder is due. */
function bucketFor(days: number, buckets: number[]): number | null {
  return buckets.includes(days) ? days : null;
}

function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // No secret configured means the endpoint stays shut rather than open.
  if (!secret) return false;

  const header = req.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token === secret;
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json(
      {
        success: false,
        error:
          'This endpoint requires the scheduler secret. Set CRON_SECRET and send it as a ' +
          'bearer token.',
      },
      { status: 401 }
    );
  }

  const now = new Date();
  const sent: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  /** Records the send first, so a crash mid-run cannot cause a resend. */
  async function claim(entityType: string, entityId: string, dayBucket: number, recipient: string) {
    try {
      await prisma.reminderSent.create({
        data: { entityType, entityId, dayBucket, recipient },
      });
      return true;
    } catch {
      // Unique constraint: this reminder has already gone out.
      return false;
    }
  }

  try {
    const pricing = await getLiveDomainPricing().catch(() => ({} as any));

    // --- domains ----------------------------------------------------------
    const domains = await prisma.domain.findMany({
      where: { status: { not: 'EXPIRED' } },
      include: { user: { select: { name: true, email: true } } },
    });

    for (const d of domains) {
      const days = daysUntil(d.expiryDate, now);
      const bucket = bucketFor(days, DOMAIN_BUCKETS);
      if (bucket === null || !d.user?.email) continue;

      if (!(await claim('DOMAIN', d.id, bucket, d.user.email))) {
        skipped.push(`${d.domainName} @${bucket}d`);
        continue;
      }

      const tld = Object.keys(pricing).find((t) => d.domainName.toLowerCase().endsWith(t));
      const info = tld ? pricing[tld] : null;

      const mail = generateRenewalReminderEmail({
        customerName: d.user.name || 'there',
        description: `Domain renewal — ${d.domainName}`,
        expiresOn: d.expiryDate,
        daysRemaining: days,
        // No invented figures: a missing price simply is not shown.
        renewalPrice: info?.renewInr || undefined,
        restorePrice: info?.restoreInr || undefined,
        currency: 'INR',
        isDomain: true,
      });

      const res = await sendEmail({ to: d.user.email, subject: mail.subject, html: mail.html });
      (res.success ? sent : failed).push(`${d.domainName} @${bucket}d`);
    }

    // --- hosting and other subscriptions ----------------------------------
    const accounts = await prisma.hostingAccount.findMany({
      where: { status: 'ACTIVE' },
      include: { user: { select: { name: true, email: true } } },
    });

    for (const h of accounts) {
      const days = daysUntil(h.nextDueDate, now);
      const bucket = bucketFor(days, SERVICE_BUCKETS);
      if (bucket === null || !h.user?.email) continue;

      if (!(await claim('HOSTING', h.id, bucket, h.user.email))) {
        skipped.push(`${h.domainName} @${bucket}d`);
        continue;
      }

      const mail = generateRenewalReminderEmail({
        customerName: h.user.name || 'there',
        description: `${h.planName} — ${h.domainName}`,
        expiresOn: h.nextDueDate,
        daysRemaining: days,
        currency: 'INR',
        isDomain: false,
      });

      const res = await sendEmail({ to: h.user.email, subject: mail.subject, html: mail.html });
      (res.success ? sent : failed).push(`${h.domainName} @${bucket}d`);
    }

    // --- upstream balance -------------------------------------------------
    // At zero, every registration, renewal and hosting order fails at once,
    // for every customer, after they have paid.
    let balance: number | null = null;
    if (isLiveApiConfigured()) {
      try {
        const res = await apiClient<any>('/billing/reseller-balance.json', {}, 'GET');
        const value = Number(res?.data?.sellingcurrencybalance ?? res?.data?.balance);
        if (Number.isFinite(value)) {
          balance = value;
          if (value < LOW_BALANCE_THRESHOLD) {
            await notifyAdmins(
              generateAdminLowBalanceEmail({
                balance: value,
                currency: 'INR',
                threshold: LOW_BALANCE_THRESHOLD,
              })
            );
          }
        }
      } catch (balErr: any) {
        console.warn('[Cron] Could not read the reseller balance:', balErr?.message);
      }
    }

    console.log(
      `[Cron] Reminders: ${sent.length} sent, ${skipped.length} already sent, ${failed.length} failed.`
    );

    return NextResponse.json({
      success: true,
      ranAt: now.toISOString(),
      sent,
      skipped,
      failed,
      balance,
    });
  } catch (error: any) {
    console.error('[Cron] Reminder run failed:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Reminder run failed.' },
      { status: 500 }
    );
  }
}
