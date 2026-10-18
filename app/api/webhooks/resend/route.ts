import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { notifyAdmins } from '@/lib/email/notify';
import { renderEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

/**
 * Resend delivery events.
 *
 * Sending through the API tells us a message was accepted, not that it
 * arrived. A renewal reminder that hard-bounces looks identical to one that
 * landed: the API returns success, the reminder is recorded as sent, and the
 * customer hears nothing until their domain has lapsed and costs eight times
 * as much to recover.
 *
 * This marks the address so later sends can skip it, and tells staff, because
 * a customer who cannot be emailed needs reaching another way.
 *
 * Resend signs webhooks with Svix. The payload is only trusted once that
 * signature verifies - anyone can POST to this URL.
 */

/** Reject anything older than this, so a captured request cannot be replayed. */
const TOLERANCE_SECONDS = 5 * 60;

function verifySignature(rawBody: string, headers: Headers): { ok: boolean; reason?: string } {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    // Unconfigured means shut, not open. Accepting unverified events would let
    // anyone mark a customer's address as bouncing.
    return { ok: false, reason: 'RESEND_WEBHOOK_SECRET is not set' };
  }

  const id = headers.get('svix-id');
  const timestamp = headers.get('svix-timestamp');
  const signature = headers.get('svix-signature');
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: 'missing Svix headers' };
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  // The secret is base64 after the whsec_ prefix.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  // The header carries a space-separated list of "v1,<signature>" pairs.
  const provided = signature
    .split(' ')
    .map((part) => part.split(',')[1])
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  const matched = provided.some((candidate) => {
    const candidateBuf = Buffer.from(candidate);
    return (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    );
  });

  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

export async function POST(req: NextRequest) {
  // The raw body is what was signed, so it must be read before parsing.
  const rawBody = await req.text();

  const check = verifySignature(rawBody, req.headers);
  if (!check.ok) {
    console.warn(`[Resend webhook] Rejected: ${check.reason}`);
    return NextResponse.json({ success: false, error: 'Invalid signature.' }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: 'Malformed payload.' }, { status: 400 });
  }

  const type: string = event?.type || '';
  const recipients: string[] = Array.isArray(event?.data?.to)
    ? event.data.to
    : event?.data?.to
    ? [event.data.to]
    : [];

  try {
    if (type === 'email.bounced' || type === 'email.complained') {
      const isComplaint = type === 'email.complained';
      const status = isComplaint ? 'COMPLAINED' : 'BOUNCED';
      const reason =
        event?.data?.bounce?.message ||
        event?.data?.reason ||
        (isComplaint ? 'Marked as spam by the recipient' : 'Delivery failed');

      for (const address of recipients) {
        const updated = await prisma.user.updateMany({
          where: { email: address },
          data: {
            emailStatus: status,
            emailIssueAt: new Date(),
            emailIssueReason: String(reason).slice(0, 300),
          },
        });

        console.error(
          `[Resend webhook] ${status} for ${address}: ${reason}` +
            (updated.count ? '' : ' (no matching customer)')
        );
      }

      await notifyAdmins({
        subject: `[Email] ${status.toLowerCase()} — ${recipients.join(', ')}`,
        html: renderEmail(
          `
          <h2 style="margin:0 0 12px; font-size:20px; color:#B91C1C;">
            ${isComplaint ? 'A customer marked our email as spam' : 'An address is not accepting mail'}
          </h2>
          <p><strong>${recipients.join(', ')}</strong></p>
          <p style="background:#F8FAFC; padding:12px; border-radius:8px; color:#1E293B;">${reason}</p>
          ${
            isComplaint
              ? `<p>Complaints damage deliverability for every customer on this domain. Stop
                 sending to this address and find out what prompted it.</p>`
              : `<p>Receipts, renewal reminders and password resets will not reach this customer.
                 They need contacting another way, and the address corrected. A domain renewal
                 missed this way costs them several times the renewal price to recover.</p>`
          }
        `,
          `${status}: ${recipients.join(', ')}`
        ),
      });
    } else if (type === 'email.delivered') {
      // A previously failing address that now delivers has been fixed.
      for (const address of recipients) {
        await prisma.user.updateMany({
          where: { email: address, emailStatus: { not: 'OK' } },
          data: { emailStatus: 'OK', emailIssueAt: null, emailIssueReason: null },
        });
      }
    }

    // Anything else - sent, opened, clicked - is acknowledged and ignored.
    return NextResponse.json({ success: true, type });
  } catch (error: any) {
    console.error('[Resend webhook] Handling failed:', error?.message);
    // A 500 makes Resend retry, which is what we want for a transient fault.
    return NextResponse.json(
      { success: false, error: 'Could not record the event.' },
      { status: 500 }
    );
  }
}
