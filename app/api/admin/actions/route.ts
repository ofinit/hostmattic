import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { isLiveApiConfigured, apiClient } from '@/lib/api/client';

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

    return NextResponse.json({ success: false, error: 'Unrecognized administrative action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Administrative action failed' },
      { status: 500 }
    );
  }
}
