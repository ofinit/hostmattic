import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiClient } from '@/lib/api/client';
import { hashPassword, requireAdmin } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// SECURITY: POST only — removed GET handler to prevent CSRF-triggered syncs
export async function POST(req: NextRequest) {
  // SECURITY: Require admin authentication
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  return handleSync();
}

async function handleSync() {
  const authUserId = process.env.RESELLER_AUTH_USERID;
  if (!authUserId) {
    return NextResponse.json(
      { success: false, error: 'RESELLER_AUTH_USERID is not configured in .env' },
      { status: 400 }
    );
  }

  const results = {
    balance: null as any,
    customersSynced: 0,
    domainsSynced: 0,
    totalCustomersInUpstream: 0,
    totalDomainsInUpstream: 0,
    errors: [] as string[],
  };

  // 1. Fetch Reseller Balance
  try {
    const balRes = await apiClient<any>('/billing/reseller-balance.json', {
      'reseller-id': authUserId,
    });
    if (balRes.success && balRes.data) {
      results.balance = {
        currency: balRes.data.sellingcurrencysymbol || 'INR',
        balance: parseFloat(balRes.data.sellingcurrencybalance || '0'),
        locked: parseFloat(balRes.data.sellingcurrencylockedbalance || '0'),
      };
    } else if (balRes.error) {
      results.errors.push(`Reseller Balance: ${balRes.error}`);
    }
  } catch (err: any) {
    results.errors.push(`Reseller Balance error: ${err.message}`);
  }

  // 2. Fetch & Sync Customers
  const customerMap = new Map<string, string>(); // upstreamCustomerId -> prismaUserId

  try {
    const custRes = await apiClient<any>('/customers/search.json', {
      'no-of-records': 100,
      'page-no': 1,
    });

    if (custRes.success && custRes.data) {
      const data = custRes.data;
      results.totalCustomersInUpstream = parseInt(data.recsindb || '0', 10);

      for (const [key, val] of Object.entries(data)) {
        if (key === 'recsindb' || key === 'recsonpage') continue;
        const item = val as Record<string, string>;

        const upstreamCustomerId = item['customer.customerid'];
        const username = item['customer.username'];
        const name = item['customer.name'] || username;
        const company = item['customer.company'] || null;
        const city = item['customer.city'] || null;
        const country = item['customer.country'] || 'IN';
        const telNo = item['customer.telno'] || '';
        const telCc = item['customer.telnocc'] || '';
        const phone = telNo ? `+${telCc}${telNo}` : null;
        const rawCreation = item['customer.creationtime'];
        const createdAt = rawCreation ? new Date(parseInt(rawCreation, 10) * 1000) : new Date();

        if (!username) continue;

        // SECURITY: Generate unique random password per customer (not hardcoded)
        const randomPassword = crypto.randomBytes(24).toString('base64url');
        const defaultPasswordHash = await hashPassword(randomPassword);

        try {
          const user = await prisma.user.upsert({
            where: { email: username.toLowerCase().trim() },
            update: {
              name,
              company,
              upstreamCustomerId,
              phone,
              city,
              country,
            },
            create: {
              email: username.toLowerCase().trim(),
              passwordHash: defaultPasswordHash,
              name,
              company,
              upstreamCustomerId,
              phone,
              city,
              country,
              createdAt,
            },
          });

          customerMap.set(upstreamCustomerId, user.id);
          results.customersSynced++;
        } catch (dbErr: any) {
          console.error(`[Sync Customer DB Error] ${username}:`, dbErr.message);
        }
      }
    } else if (custRes.error) {
      results.errors.push(`Customer search: ${custRes.error}`);
    }
  } catch (err: any) {
    results.errors.push(`Customer search error: ${err.message}`);
  }

  // Ensure an admin/fallback user exists for any unlinked domains
  let fallbackUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!fallbackUser) {
    const adminPassword = crypto.randomBytes(24).toString('base64url');
    const adminPasswordHash = await hashPassword(adminPassword);
    fallbackUser = await prisma.user.create({
      data: {
        email: 'admin@hostmattic.com',
        name: 'Hostmattic Administrator',
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
      },
    });
    // Log the generated admin password so it can be securely recorded
    console.log(`[Sync] Created admin user with generated password. Set a permanent password via the admin panel.`);
  }

  // 3. Fetch & Sync Domains
  try {
    const domRes = await apiClient<any>('/domains/search.json', {
      'no-of-records': 100,
      'page-no': 1,
    });

    if (domRes.success && domRes.data) {
      const data = domRes.data;
      results.totalDomainsInUpstream = parseInt(data.recsindb || '0', 10);

      for (const [key, val] of Object.entries(data)) {
        if (key === 'recsindb' || key === 'recsonpage') continue;
        const item = val as Record<string, string>;

        const domainName = (item['entity.description'] || '').toLowerCase().trim();
        if (!domainName) continue;

        const upstreamOrderId = item['orders.orderid'] || item['entity.entityid'];
        const upstreamCustId = item['entity.customerid'];
        const rawStatus = (item['entity.currentstatus'] || 'Active').toUpperCase();
        const status = rawStatus.includes('ACTIVE') ? 'ACTIVE' : rawStatus.includes('SUSPEND') ? 'SUSPENDED' : 'EXPIRED';
        const autoRenew = item['orders.autorenew'] === 'true';
        const privacyEnabled = item['orders.privacyprotection'] === 'true';

        const rawCreated = item['orders.creationtime'] || item['orders.creationdt'];
        const registrationDate = rawCreated ? new Date(parseInt(rawCreated, 10) * 1000) : new Date();

        const rawEnd = item['orders.endtime'];
        const expiryDate = rawEnd ? new Date(parseInt(rawEnd, 10) * 1000) : new Date(Date.now() + 365 * 86400000);

        const parts = domainName.split('.');
        const tld = parts.length > 1 ? `.${parts.slice(1).join('.')}` : '.com';

        // Match owner
        let assignedUserId = upstreamCustId ? customerMap.get(upstreamCustId) : null;
        if (!assignedUserId && upstreamCustId) {
          const u = await prisma.user.findFirst({ where: { upstreamCustomerId: upstreamCustId } });
          if (u) assignedUserId = u.id;
        }
        if (!assignedUserId) {
          assignedUserId = fallbackUser.id;
        }

        try {
          await prisma.domain.upsert({
            where: { domainName },
            update: {
              status,
              autoRenew,
              privacyEnabled,
              expiryDate,
              upstreamOrderId,
              userId: assignedUserId,
            },
            create: {
              domainName,
              tld,
              status,
              autoRenew,
              privacyEnabled,
              registrationDate,
              expiryDate,
              upstreamOrderId,
              userId: assignedUserId,
            },
          });

          results.domainsSynced++;
        } catch (domDbErr: any) {
          console.error(`[Sync Domain DB Error] ${domainName}:`, domDbErr.message);
        }
      }
    } else if (domRes.error) {
      results.errors.push(`Domain search: ${domRes.error}`);
    }
  } catch (err: any) {
    results.errors.push(`Domain search error: ${err.message}`);
  }

  return NextResponse.json({
    success: results.customersSynced > 0 || results.domainsSynced > 0,
    message: `Synchronized ${results.customersSynced} customers and ${results.domainsSynced} domains from live upstream gateway.`,
    results,
  });
}

