import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiClient } from '@/lib/api/client';
import { hashPassword, requireAdmin } from '@/lib/auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
// A full upstream walk is a long request. Tell the platform not to cut it short.
export const maxDuration = 300;

// SECURITY: POST only — removed GET handler to prevent CSRF-triggered syncs
export async function POST(req: NextRequest) {
  // SECURITY: Require admin authentication
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  return handleSync();
}

const MAX_PAGES = 50; // hard stop so a bad `recsindb` cannot spin forever

/**
 * Resolve a domain's owner when the customer was not in the customer listing.
 * Fetches them from upstream and creates the local record, so the domain lands
 * on the real customer instead of being parked on the fallback admin account.
 */
async function recoverCustomer(
  upstreamCustomerId: string,
  customerMap: Map<string, string>
): Promise<string | null> {
  try {
    const res = await apiClient<any>('/customers/details-by-id.json', {
      'customer-id': upstreamCustomerId,
    });
    if (!res.success || !res.data) return null;

    const d = res.data;
    const username: string = d.username || d['customer.username'] || '';
    if (!username) return null;

    const telNo = d.telno || '';
    const telCc = d.telnocc || '';

    const user = await prisma.user.upsert({
      where: { email: username.toLowerCase().trim() },
      update: { upstreamCustomerId },
      create: {
        email: username.toLowerCase().trim(),
        passwordHash: await hashPassword(crypto.randomBytes(24).toString('base64url')),
        name: d.name || username,
        company: d.company || null,
        city: d.city || null,
        country: d.country || 'IN',
        phone: telNo ? `+${telCc}${telNo}` : null,
        upstreamCustomerId,
      },
    });

    customerMap.set(upstreamCustomerId, user.id);
    return user.id;
  } catch (e: any) {
    console.warn(`[Sync] Could not recover customer ${upstreamCustomerId}:`, e?.message);
    return null;
  }
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
    customersRecovered: 0,   // created from a domain whose owner was not in the customer list
    domainsUnassigned: 0,    // owner could not be resolved; parked on the fallback account
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
    // Walk every page. A single page-1 request silently dropped every customer
    // past the first 100, and their domains then fell through to the fallback
    // account - which is why customer dossiers showed zero services.
    const PAGE_SIZE = 100;
    let page = 1;
    let fetched = 0;

    while (page <= MAX_PAGES) {
      const custRes = await apiClient<any>('/customers/search.json', {
        'no-of-records': PAGE_SIZE,
        'page-no': page,
      });

      if (!custRes.success || !custRes.data) {
        if (custRes.error) results.errors.push(`Customer search (page ${page}): ${custRes.error}`);
        break;
      }

      const data = custRes.data;
      results.totalCustomersInUpstream = parseInt(data.recsindb || '0', 10);
      const onPage = parseInt(data.recsonpage || '0', 10);

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

        const emailKey = username.toLowerCase().trim();

        try {
          // Hash ONLY when creating. bcrypt at cost 12 is roughly a quarter of a
          // second of blocked CPU, and upsert computed it for every customer on
          // every page even when the row already existed - enough, once the fetch
          // was paginated, to run the whole request past the proxy timeout and
          // return an empty body to the browser.
          const existing = await prisma.user.findUnique({
            where: { email: emailKey },
            select: { id: true },
          });

          let user;
          if (existing) {
            user = await prisma.user.update({
              where: { id: existing.id },
              data: { name, company, upstreamCustomerId, phone, city, country },
              select: { id: true },
            });
          } else {
            // Placeholder credential: synced customers sign in through SSO or a
            // password reset, never with this value.
            const defaultPasswordHash = await hashPassword(
              crypto.randomBytes(24).toString('base64url')
            );
            user = await prisma.user.create({
              data: {
                email: emailKey,
                passwordHash: defaultPasswordHash,
                name,
                company,
                upstreamCustomerId,
                phone,
                city,
                country,
                createdAt,
              },
              select: { id: true },
            });
          }

          customerMap.set(upstreamCustomerId, user.id);
          results.customersSynced++;
        } catch (dbErr: any) {
          console.error(`[Sync Customer DB Error] ${username}:`, dbErr.message);
        }
      }

      fetched += onPage;
      if (onPage < PAGE_SIZE || fetched >= results.totalCustomersInUpstream) break;
      page++;
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
    const DOM_PAGE_SIZE = 100;
    let domPage = 1;
    let domFetched = 0;

    while (domPage <= MAX_PAGES) {
      const domRes = await apiClient<any>('/domains/search.json', {
        'no-of-records': DOM_PAGE_SIZE,
        'page-no': domPage,
      });

      if (!domRes.success || !domRes.data) {
        if (domRes.error) results.errors.push(`Domain search (page ${domPage}): ${domRes.error}`);
        break;
      }

      const data = domRes.data;
      results.totalDomainsInUpstream = parseInt(data.recsindb || '0', 10);
      const domOnPage = parseInt(data.recsonpage || '0', 10);

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

        // Resolve the real owner. Previously an unresolved owner silently assigned
        // the domain to the fallback ADMIN account, so the domain vanished from the
        // customer's dossier while the sync still reported it as synchronised.
        let assignedUserId: string | null | undefined =
          upstreamCustId ? customerMap.get(upstreamCustId) : null;

        if (!assignedUserId && upstreamCustId) {
          const u = await prisma.user.findFirst({ where: { upstreamCustomerId: upstreamCustId } });
          if (u) {
            assignedUserId = u.id;
            customerMap.set(upstreamCustId, u.id);
          }
        }

        // Still unknown: pull the customer from upstream rather than orphaning the domain.
        if (!assignedUserId && upstreamCustId) {
          const recovered = await recoverCustomer(upstreamCustId, customerMap);
          if (recovered) {
            assignedUserId = recovered;
            results.customersRecovered++;
          }
        }

        if (!assignedUserId) {
          assignedUserId = fallbackUser.id;
          results.domainsUnassigned++;
          console.warn(
            `[Sync] ${domainName}: no upstream customer id on the record ` +
            `(entity.customerid=${upstreamCustId || 'missing'}); parked on fallback account.`
          );
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

      domFetched += domOnPage;
      if (domOnPage < DOM_PAGE_SIZE || domFetched >= results.totalDomainsInUpstream) break;
      domPage++;
    }
  } catch (err: any) {
    results.errors.push(`Domain search error: ${err.message}`);
  }

  return NextResponse.json({
    success: results.customersSynced > 0 || results.domainsSynced > 0,
    message:
      `Synchronized ${results.customersSynced} customers and ${results.domainsSynced} domains from live upstream gateway.` +
      (results.customersRecovered
        ? ` Recovered ${results.customersRecovered} customer${results.customersRecovered === 1 ? '' : 's'} referenced by a domain but missing from the customer list.`
        : '') +
      (results.domainsUnassigned
        ? ` ${results.domainsUnassigned} domain${results.domainsUnassigned === 1 ? '' : 's'} had no resolvable owner and are held on the fallback account.`
        : ''),
    results,
  });
}

