import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { isLiveApiConfigured, apiClient } from '@/lib/api/client';
import { fulfilOrder } from '@/lib/services/fulfilment';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require admin authentication
    const session = requireAdmin(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { action, targetId, status, priority, reason, newPassword } = body;

    // 1. Update Ticket Status or Priority
    if (action === 'update-ticket') {
      try {
        await prisma.supportTicket.update({
          where: { id: targetId },
          data: {
            ...(status ? { status } : {}),
            ...(priority ? { priority } : {}),
            updatedAt: new Date(),
          },
        });
      } catch (dbErr) {}

      return NextResponse.json({
        success: true,
        message: `Ticket ${targetId} updated to status: ${status || 'unchanged'}, priority: ${priority || 'unchanged'}`,
      });
    }

    // 2. Suspend Hosting Account
    if (action === 'suspend-hosting') {
      try {
        await prisma.hostingAccount.update({
          where: { id: targetId },
          data: { status: 'SUSPENDED' },
        });
      } catch (dbErr) {}

      if (isLiveApiConfigured()) {
        await apiClient('/orders/suspend.json', { 'order-id': targetId, 'reason': reason || 'Administrative suspension' }, 'POST');
      }

      return NextResponse.json({
        success: true,
        status: 'SUSPENDED',
        message: `Hosting service suspended: ${reason || 'Administrative action'}`,
      });
    }

    // 3. Unsuspend Hosting Account
    if (action === 'unsuspend-hosting') {
      try {
        await prisma.hostingAccount.update({
          where: { id: targetId },
          data: { status: 'ACTIVE' },
        });
      } catch (dbErr) {}

      if (isLiveApiConfigured()) {
        await apiClient('/orders/unsuspend.json', { 'order-id': targetId }, 'POST');
      }

      return NextResponse.json({
        success: true,
        status: 'ACTIVE',
        message: `Hosting service unsuspended and restored to full active service.`,
      });
    }

    // 4. Delete customer accounts (single or bulk)
    //
    // Guards: never an ADMIN, never yourself, and never an account that still
    // holds services or billing history unless the caller explicitly forces it.
    // Retry a paid order whose provisioning failed. The money is already
    // taken, so the service is owed; this is the path that settles it rather
    // than leaving the customer waiting on a line nobody can see.
    if (action === 'retry-fulfilment') {
      const orderId = (body?.orderId || targetId || '').toString().trim();
      if (!orderId) {
        return NextResponse.json(
          { success: false, error: 'No order specified.' },
          { status: 400 }
        );
      }

      try {
        const result = await fulfilOrder(orderId);
        console.log(
          `[Hostmattic] FULFILMENT RETRY by ${session.email} on ${result.orderNumber}: ` +
            `${result.provisioned} provisioned, ${result.failed} failed`
        );
        return NextResponse.json({
          success: true,
          result,
          message:
            result.failed > 0
              ? `${result.provisioned} line(s) provisioned, ${result.failed} still failing.`
              : `Order ${result.orderNumber} is fully provisioned.`,
        });
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: err?.message || 'Could not fulfil the order.' },
          { status: 400 }
        );
      }
    }

    if (action === 'delete-customers') {
      const ids: string[] = Array.isArray(body?.customerIds)
        ? body.customerIds.filter((x: unknown) => typeof x === 'string' && x)
        : targetId ? [targetId] : [];

      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: 'No customers selected.' }, { status: 400 });
      }
      if (ids.length > 200) {
        return NextResponse.json({ success: false, error: 'Select at most 200 accounts at a time.' }, { status: 400 });
      }

      const force = body?.force === true;

      const candidates = await prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, email: true, role: true,
          _count: { select: { domains: true, hostingAccounts: true, orders: true } },
        },
      });

      const deleted: string[] = [];
      const skipped: { email: string; reason: string }[] = [];

      for (const c of candidates) {
        if (c.role === 'ADMIN') {
          skipped.push({ email: c.email, reason: 'administrator account' });
          continue;
        }
        if (c.id === session.id) {
          skipped.push({ email: c.email, reason: 'your own account' });
          continue;
        }
        const services = c._count.domains + c._count.hostingAccounts + c._count.orders;
        if (services > 0 && !force) {
          skipped.push({
            email: c.email,
            reason: `has ${c._count.domains} domain(s), ${c._count.hostingAccounts} hosting and ${c._count.orders} order(s)`,
          });
          continue;
        }

        try {
          await prisma.user.delete({ where: { id: c.id } });
          deleted.push(c.email);
        } catch (delErr: any) {
          skipped.push({ email: c.email, reason: delErr?.message || 'delete failed' });
        }
      }

      console.log(`[Hostmattic] Admin deleted ${deleted.length} customer account(s); ${skipped.length} skipped.`);

      return NextResponse.json({
        success: true,
        deletedCount: deleted.length,
        skippedCount: skipped.length,
        deleted,
        skipped,
        message:
          `Deleted ${deleted.length} account${deleted.length === 1 ? '' : 's'}.` +
          (skipped.length ? ` Skipped ${skipped.length}: ${skipped.map((x) => x.email + ' (' + x.reason + ')').join(', ')}.` : ''),
      });
    }

    return NextResponse.json({ success: false, error: 'Unrecognized administrative action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Administrative action failed' },
      { status: 500 }
    );
  }
}
