import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { computeExpirationAnalytics } from '@/lib/analytics/pnl';

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
          expiryDate: new Date(Date.now() + 86400000 * 18).toISOString(), // Expiring in 18 days!
          autoRenew: true,
          privacyEnabled: true,
          nameservers: 'ns1.hostmattic.com,ns2.hostmattic.com',
        },
        {
          id: 'dom_2',
          domainName: 'cloudhost-matrix.io',
          tld: '.io',
          status: 'ACTIVE',
          expiryDate: new Date(Date.now() + 86400000 * 240).toISOString(),
          autoRenew: false,
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
          nextDueDate: new Date(Date.now() + 86400000 * 18).toISOString(), // Due in 18 days!
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

    // Enrich domains with daysUntilExpiry
    const enrichedDomains = domains.map((d: any) => {
      const diffDays = Math.ceil((new Date(d.expiryDate).getTime() - Date.now()) / 86400000);
      return {
        ...d,
        daysUntilExpiry: diffDays,
        isExpired: diffDays < 0,
        isExpiringSoon: diffDays >= 0 && diffDays <= 30,
        isCritical: diffDays >= 0 && diffDays <= 7,
      };
    });

    // Enrich hosting with daysUntilExpiry
    const enrichedHosting = hosting.map((h: any) => {
      const targetDate = h.nextDueDate || h.createdAt;
      const diffDays = Math.ceil((new Date(targetDate).getTime() - Date.now()) / 86400000);
      return {
        ...h,
        daysUntilExpiry: diffDays,
        isExpired: diffDays < 0,
        isExpiringSoon: diffDays >= 0 && diffDays <= 30,
        isCritical: diffDays >= 0 && diffDays <= 7,
      };
    });

    // Extract Add-ons & Subscriptions (SSL, SiteLock, Email, Backups)
    let addons: any[] = [];
    orders.forEach((o: any) => {
      (o.items || []).forEach((it: any) => {
        const pType = (it.productType || '').toUpperCase();
        if (
          ['SECURITY', 'EMAIL', 'SSL', 'BACKUP', 'TOOLS', 'BUNDLE'].includes(pType) ||
          pType.includes('SSL') ||
          pType.includes('EMAIL') ||
          pType.includes('SECURITY') ||
          pType.includes('SITELOCK')
        ) {
          addons.push({
            id: it.id || `addon_${addons.length + 1}`,
            orderNumber: o.orderNumber,
            productType: it.productType || 'SECURITY',
            name: it.description,
            price: it.price,
            currency: o.currency || 'USD',
            billingPeriod: it.billingPeriod || 'ANNUAL',
            status: o.status === 'COMPLETED' ? 'ACTIVE' : 'PENDING',
            domainName: it.domainName || 'hostmattic-sample.com',
            createdAt: o.createdAt,
            expiryDate: new Date(new Date(o.createdAt).getTime() + 86400000 * 365).toISOString(),
            daysUntilExpiry: Math.ceil((new Date(new Date(o.createdAt).getTime() + 86400000 * 365).getTime() - Date.now()) / 86400000),
          });
        }
      });
    });

    if (addons.length === 0) {
      addons = [
        {
          id: 'addon_cust_1',
          productType: 'SECURITY',
          category: 'SSL',
          name: 'PositiveSSL Wildcard Certificate (DV)',
          domainName: 'hostmattic-sample.com',
          price: 30.99,
          currency: 'USD',
          billingPeriod: 'ANNUAL',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 86400000 * 45).toISOString(),
          expiryDate: new Date(Date.now() + 86400000 * 320).toISOString(),
          daysUntilExpiry: 320,
        },
        {
          id: 'addon_cust_2',
          productType: 'EMAIL',
          category: 'EMAIL',
          name: 'Business Email Inbox (5 GB Cloud Storage)',
          domainName: 'hostmattic-sample.com',
          price: 7.10,
          currency: 'USD',
          billingPeriod: 'ANNUAL',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          expiryDate: new Date(Date.now() + 86400000 * 350).toISOString(),
          daysUntilExpiry: 350,
        },
        {
          id: 'addon_cust_3',
          productType: 'SECURITY',
          category: 'SECURITY',
          name: 'SiteLock Web Application Firewall (Daily Scanner & Auto-Patch)',
          domainName: 'hostmattic-sample.com',
          price: 19.99,
          currency: 'USD',
          billingPeriod: 'ANNUAL',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          expiryDate: new Date(Date.now() + 86400000 * 350).toISOString(),
          daysUntilExpiry: 350,
        },
      ];
    }

    // Enrich tickets with reply tracking & response telemetry
    const enrichedTickets = tickets.map((t: any) => {
      const replies = t.replies || [];
      const latestReply = replies.length > 0 ? replies[replies.length - 1] : null;
      const lastRepliedAt = latestReply?.createdAt || t.updatedAt || t.createdAt;
      const lastRepliedBy = latestReply?.senderType || 'CUSTOMER';
      const lastRepliedByName = latestReply?.senderName || (lastRepliedBy === 'STAFF' ? 'Support Engineer' : 'You');

      return {
        ...t,
        lastRepliedAt,
        lastRepliedBy,
        lastRepliedByName,
      };
    });

    // Compute Expiration Analytics for Customer
    const expirations = computeExpirationAnalytics(domains, hosting);

    return NextResponse.json({
      success: true,
      user: session,
      domains: enrichedDomains,
      hosting: enrichedHosting,
      orders,
      addons,
      tickets: enrichedTickets,
      expirations,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch services' },
      { status: 500 }
    );
  }
}
