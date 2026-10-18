/**
 * Delivering an order, once it has actually been paid for.
 *
 * Checkout used to provision inline, in the same request that posted
 * `paymentStatus: 'PENDING'` and before the payment window had even opened, so
 * a customer who closed that window kept the service. Removing it closed the
 * hole and left no path to upstream at all: orders recorded, invoices issued,
 * nothing registered.
 *
 * Fulfilment now hangs off the verified-payment path. The rules it follows:
 *
 *  - only a PAID order is fulfilled, and payment is established by the
 *    gateway's signature, never by anything in a request body;
 *  - each line is provisioned at most once, tracked on the line itself, so a
 *    retry after a partial failure cannot double-register a domain;
 *  - a line that fails is recorded as FAILED with the upstream error and left
 *    for an administrator. Payment has been taken, so the service is owed: it
 *    must be visible and retryable, never silently dropped;
 *  - the order is only COMPLETED when every line is delivered.
 */

import { prisma } from '@/lib/prisma';
import { registerDomain, transferDomain } from '@/lib/api/domains';
import { provisionHosting } from '@/lib/api/hosting';
import { sendEmail } from '@/lib/email/resend';
import { notifyAdmins } from '@/lib/email/notify';
import { ensureUpstreamCustomer } from '@/lib/services/upstreamCustomer';
import { ensureDomainContacts } from '@/lib/api/contacts';
import {
  generateServiceActivatedEmail,
  generateActivationDelayedEmail,
  generateAdminFulfilmentFailedEmail,
} from '@/lib/email/lifecycle';

export interface FulfilmentResult {
  orderNumber: string;
  attempted: number;
  provisioned: number;
  failed: number;
  skipped: number;
  lines: Array<{
    description: string;
    status: 'PROVISIONED' | 'FAILED' | 'NOT_REQUIRED' | 'ALREADY_DONE';
    upstreamOrderId?: string;
    error?: string;
  }>;
}

/** The upstream customer this order provisions against. */
async function upstreamCustomerId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { upstreamCustomerId: true },
  });
  // No invented fallback. Provisioning against a guessed customer id would
  // attach the service to somebody else's account.
  return user?.upstreamCustomerId || null;
}

export async function fulfilOrder(orderId: string): Promise<FulfilmentResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          company: true,
          address: true,
          city: true,
          state: true,
          country: true,
          zip: true,
        },
      },
    },
  });

  if (!order) throw new Error('Order not found.');

  const result: FulfilmentResult = {
    orderNumber: order.orderNumber,
    attempted: 0,
    provisioned: 0,
    failed: 0,
    skipped: 0,
    lines: [],
  };

  // Paid orders only. This is the guard that the old inline provisioning
  // lacked entirely.
  if (order.paymentStatus !== 'PAID') {
    throw new Error(`Order ${order.orderNumber} is not paid, so it cannot be fulfilled.`);
  }

  // Create the upstream account now if the customer has none, using the
  // billing details on this order. They are real: the invoice required them.
  let customerId = await upstreamCustomerId(order.userId);
  let customerError: string | undefined;

  if (!customerId) {
    const ensured = await ensureUpstreamCustomer(order.userId, {
      billingAddress: order.billingAddress,
      billingCity: order.billingCity,
      billingState: order.billingState,
      billingCountry: order.billingCountry,
      billingZip: order.billingZip,
    });
    customerId = ensured.customerId;
    customerError = ensured.error;
  }

  for (const item of order.items) {
    if (item.provisionStatus === 'PROVISIONED') {
      result.skipped++;
      result.lines.push({ description: item.description, status: 'ALREADY_DONE' });
      continue;
    }

    const isDomain = item.productType === 'DOMAIN' || Boolean(item.domainName && !item.planId);
    const isHosting = Boolean(item.planId);

    if (!isDomain && !isHosting) {
      // Nothing upstream delivers for this line - a bundle we resell
      // ourselves, say. Mark it so it stops being counted as outstanding.
      await prisma.orderItem.update({
        where: { id: item.id },
        data: { provisionStatus: 'NOT_REQUIRED' },
      });
      result.skipped++;
      result.lines.push({ description: item.description, status: 'NOT_REQUIRED' });
      continue;
    }

    if (!customerId) {
      const why =
        customerError || 'No upstream customer account is linked to this user.';
      await markFailed(item.id, why);
      result.attempted++;
      result.failed++;
      result.lines.push({ description: item.description, status: 'FAILED', error: why });
      continue;
    }

    result.attempted++;

    try {
      let response;

      if (isDomain) {
        const years = item.years && item.years > 0 ? item.years : 1;
        const transferring = /transfer/i.test(item.description);

        // A domain order needs registrant, admin, technical and billing
        // contacts. They become the public WHOIS record, so they are built
        // from the customer's own details and nothing is substituted.
        const { contacts, error: contactError } = await ensureDomainContacts(customerId, {
          name: order.user?.name || order.user?.email || '',
          company: order.user?.company || '',
          email: order.user?.email || '',
          address: order.billingAddress || order.user?.address || '',
          city: order.billingCity || order.user?.city || '',
          state: order.billingState || order.user?.state || '',
          country: order.billingCountry || order.user?.country || '',
          zipcode: order.billingZip || order.user?.zip || '',
          phoneCc: '91',
          phone: (order.user?.phone || '').replace(/\D/g, '').slice(-10),
        });

        if (!contacts) {
          const why = contactError || 'Could not create a registrant contact.';
          await markFailed(item.id, why);
          result.failed++;
          result.lines.push({ description: item.description, status: 'FAILED', error: why });
          continue;
        }

        response = transferring
          ? await transferDomain({
              domainName: item.domainName || '',
              customerId,
              authCode: item.authCode || '',
              contacts,
              years,
            })
          : await registerDomain({
              domainName: item.domainName || '',
              customerId,
              contacts,
              years,
            });
      } else {
        response = await provisionHosting({
          productType: (item.productType as any) || 'SHARED_LINUX',
          domainName: item.domainName || '',
          customerId,
          planId: item.planId || undefined,
          months: item.months && item.months > 0 ? item.months : 12,
        });
      }

      if (!response?.success) {
        const message = response?.error || 'Upstream declined the request.';
        await markFailed(item.id, message);
        result.failed++;
        result.lines.push({ description: item.description, status: 'FAILED', error: message });
        continue;
      }

      const upstreamId = String(
        (response.data as any)?.entityid ?? (response.data as any)?.entityId ?? ''
      );

      await prisma.orderItem.update({
        where: { id: item.id },
        data: {
          provisionStatus: 'PROVISIONED',
          upstreamOrderId: upstreamId || null,
          provisionError: null,
          provisionedAt: new Date(),
          provisionAttempts: { increment: 1 },
        },
      });

      result.provisioned++;
      result.lines.push({
        description: item.description,
        status: 'PROVISIONED',
        upstreamOrderId: upstreamId || undefined,
      });

      // What the customer needs next differs by product, so this is sent per
      // line rather than once per order.
      if (order.user?.email) {
        const mail = generateServiceActivatedEmail({
          customerName: order.user.name || 'there',
          productType: item.productType || '',
          description: item.description,
          domainName: item.domainName || undefined,
          orderNumber: order.orderNumber,
        });
        sendEmail({ to: order.user.email, subject: mail.subject, html: mail.html }).catch((e) =>
          console.warn('[Fulfilment] activation email failed:', e?.message)
        );
      }
    } catch (err: any) {
      const message = err?.message || 'Provisioning threw an unexpected error.';
      await markFailed(item.id, message);
      result.failed++;
      result.lines.push({ description: item.description, status: 'FAILED', error: message });
    }
  }

  // COMPLETED means delivered, not merely paid. A partially fulfilled order
  // stays visible as outstanding work.
  const refreshed = await prisma.orderItem.findMany({ where: { orderId: order.id } });
  const outstanding = refreshed.filter(
    (i) => i.provisionStatus !== 'PROVISIONED' && i.provisionStatus !== 'NOT_REQUIRED'
  );

  await prisma.order.update({
    where: { id: order.id },
    data: { status: outstanding.length ? 'AWAITING_FULFILMENT' : 'COMPLETED' },
  });

  if (result.failed) {
    console.error(
      `[Fulfilment] ${order.orderNumber}: ${result.failed} line(s) failed after payment was taken. ` +
        'These are owed to the customer and need an administrator.'
    );

    const failures = result.lines.filter((l) => l.status === 'FAILED');

    // The customer has paid for something they have not received. Silence is
    // the worst of the options available.
    if (order.user?.email) {
      const mail = generateActivationDelayedEmail({
        customerName: order.user.name || 'there',
        orderNumber: order.orderNumber,
        descriptions: failures.map((f) => f.description),
      });
      sendEmail({ to: order.user.email, subject: mail.subject, html: mail.html }).catch((e) =>
        console.warn('[Fulfilment] delay email failed:', e?.message)
      );
    }

    await notifyAdmins(
      generateAdminFulfilmentFailedEmail({
        orderNumber: order.orderNumber,
        customerEmail: order.user?.email || 'unknown',
        failures: failures.map((f) => ({ description: f.description, error: f.error })),
        amount: order.totalAmount,
        currency: order.currency,
      })
    );
  }

  return result;
}

async function markFailed(itemId: string, error: string) {
  await prisma.orderItem.update({
    where: { id: itemId },
    data: {
      provisionStatus: 'FAILED',
      provisionError: error.slice(0, 500),
      provisionAttempts: { increment: 1 },
    },
  });
}
