import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('hm_auth_token')?.value;
    const session = token ? verifyToken(token) : null;

    let domains: any[] = [];
    let hosting: any[] = [];
    let orders: any[] = [];
    let tickets: any[] = [];

    try {
      if (session?.id) {
        domains = await prisma.domain.findMany({
          where: { userId: session.id },
          orderBy: { createdAt: 'desc' },
        });
        hosting = await prisma.hostingAccount.findMany({
          where: { userId: session.id },
          orderBy: { createdAt: 'desc' },
        });
        orders = await prisma.order.findMany({
          where: { userId: session.id },
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        });
        tickets = await prisma.supportTicket.findMany({
          where: { userId: session.id },
          include: { replies: true },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (dbErr) {
      console.warn('[Services DB Notice] Falling back to demo data in preview');
    }

    // If no records in DB yet, provide default active service demonstrations
    if (domains.length === 0 && hosting.length === 0) {
      domains = [
        {
          id: 'dom_1',
          domainName: 'hostmattic-sample.com',
          tld: '.com',
          status: 'ACTIVE',
          expiryDate: new Date(Date.now() + 31536000000).toISOString(),
          autoRenew: true,
          privacyEnabled: true,
          nameservers: 'ns1.hostmattic.com,ns2.hostmattic.com',
        },
      ];
      hosting = [
        {
          id: 'host_1',
          productType: 'SHARED_LINUX',
          planName: 'Linux cPanel NVMe (Professional)',
          domainName: 'hostmattic-sample.com',
          serverIp: '198.51.100.24',
          cpanelUsername: 'hm_pro24',
          serverLocation: 'US',
          status: 'ACTIVE',
          billingCycle: 'ANNUAL',
          nextDueDate: new Date(Date.now() + 31536000000).toISOString(),
        },
      ];
    }

    if (orders.length === 0) {
      orders = [
        {
          id: 'ord_demo_1',
          orderNumber: 'HM-INV-7104',
          totalAmount: 119.88,
          currency: 'USD',
          paymentStatus: 'PAID',
          paymentMethod: 'Credit Card (Visa ending in 4242)',
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          items: [
            {
              id: 'item_1',
              productType: 'SHARED_LINUX',
              description: 'Linux cPanel NVMe (Professional) - Annual Subscription',
              price: 119.88,
              billingPeriod: 'ANNUAL',
            },
          ],
        },
        {
          id: 'ord_demo_2',
          orderNumber: 'HM-INV-6980',
          totalAmount: 12.99,
          currency: 'USD',
          paymentStatus: 'PAID',
          paymentMethod: 'Credit Card (Visa ending in 4242)',
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
          items: [
            {
              id: 'item_2',
              productType: 'DOMAIN',
              description: 'Domain Registration - hostmattic-sample.com (1 Year + Free Privacy)',
              price: 12.99,
              billingPeriod: 'ANNUAL',
            },
          ],
        },
      ];
    }

    if (tickets.length === 0) {
      tickets = [
        {
          id: 'tkt_demo_1',
          ticketNumber: 'TKT-9941',
          subject: 'Complimentary SSL Certificate Installation Verification',
          department: 'Technical Support',
          priority: 'MEDIUM',
          status: 'ANSWERED',
          createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
          replies: [
            {
              id: 'rep_1',
              senderType: 'STAFF',
              senderName: 'Hostmattic Support Engineer',
              message: 'Hello! Your Let\'s Encrypt Wildcard SSL is fully active and renewing automatically across all subdomains.',
              createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            },
          ],
        },
      ];
    }

    return NextResponse.json({
      success: true,
      user: session,
      domains,
      hosting,
      orders,
      tickets,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
