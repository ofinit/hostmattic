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
    include: { items: true },
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

  const customerId = await upstreamCustomerId(order.userId);

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
      await markFailed(item.id, 'No upstream customer account is linked to this user.');
      result.attempted++;
      result.failed++;
      result.lines.push({
        description: item.description,
        status: 'FAILED',
        error: 'No upstream customer account is linked to this user.',
      });
      continue;
    }

    result.attempted++;

    try {
      let response;

      if (isDomain) {
        const years = item.years && item.years > 0 ? item.years : 1;
        const transferring = /transfer/i.test(item.description);
        response = transferring
          ? await transferDomain({
              domainName: item.domainName || '',
              customerId,
              authCode: item.authCode || '',
              years,
            })
          : await registerDomain({
              domainName: item.domainName || '',
              customerId,
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
