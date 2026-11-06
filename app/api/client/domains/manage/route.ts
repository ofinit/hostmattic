import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLiveApiConfigured, apiClient } from '@/lib/api/client';
import { getDomainOrderId, modifyNameservers } from '@/lib/api/domains';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Domain management, scoped to the signed-in customer.
 *
 * Two classes of fault were fixed here together, because they compounded:
 *
 * 1. NO OWNERSHIP CHECK. Every action addressed the domain by the name in the
 *    request body and nothing else - updateMany({ where: { domainName } })
 *    with no userId. Any signed-in customer could repoint another customer's
 *    nameservers, unlock their transfer lock, or read their EPP auth code.
 *    The last two together are a domain theft: unlock, take the code, move
 *    the domain to another registrar. Domain names are public, so there was
 *    nothing to guess.
 *
 * 2. UPSTREAM RESULTS WERE DISCARDED. Each call awaited apiClient and threw
 *    the result away, and the route answered success: true regardless. The
 *    local row was written FIRST, so a rejected call left the portal showing
 *    nameservers the registry had never been told about - which is exactly
 *    what happened to chaitanyaholidayhomes.in.
 *
 * The parameters were wrong as well: these endpoints address a domain by
 * order-id, never domain-name, and want ns repeated once per server rather
 * than ns1/ns2/ns3. See modifyNameservers in lib/api/domains.
 *
 * The order is now: establish ownership, call upstream, check what it said,
 * and only then write locally. A local row that disagrees with the registry
 * is worse than an error message, because the customer believes it.
 */

/** The domain, but only if it belongs to this customer. */
async function loadOwnedDomain(domainName: string, userId: string) {
  return prisma.domain.findFirst({
    where: { domainName: String(domainName).trim().toLowerCase(), userId },
  });
}

/**
 * The upstream order id, from the local row or looked up and then saved.
 *
 * Domains repaired by scripts/backfill-services.js can have no stored id, so
 * a lookup is a legitimate path rather than an error.
 */
async function resolveOrderId(domain: {
  id: string;
  domainName: string;
  upstreamOrderId: string | null;
}): Promise<{ orderId: string } | { error: string }> {
  if (domain.upstreamOrderId) return { orderId: domain.upstreamOrderId };

  const res = await getDomainOrderId(domain.domainName);
  if (!res.success || !res.data) {
    return { error: res.error || `Could not determine the upstream order for ${domain.domainName}.` };
  }

  // Worth persisting: it does not change, and the next call should not have
  // to ask again.
  try {
    await prisma.domain.update({ where: { id: domain.id }, data: { upstreamOrderId: res.data } });
  } catch {
    // Not fatal - we have the id for this request either way.
  }
  return { orderId: res.data };
}

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { domainName, action, nameservers, theftProtection, privacyProtection } = body;

    if (!domainName) {
      return NextResponse.json({ success: false, error: 'Domain name is required' }, { status: 400 });
    }

    const domain = await loadOwnedDomain(domainName, session.id);
    if (!domain) {
      // 404, not 403: confirming that a domain exists but belongs to someone
      // else is itself a disclosure.
      return NextResponse.json(
        { success: false, error: 'No such domain on your account.' },
        { status: 404 }
      );
    }

    // 1. Get Auth / EPP Code
    if (action === 'get-auth-code') {
      if (!isLiveApiConfigured()) {
        return NextResponse.json({
          success: true,
          domainName: domain.domainName,
          authCode: 'HM@' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!99',
          isMock: true,
        });
      }

      const res = await apiClient<any>('/domains/details-by-name.json', {
        'domain-name': domain.domainName,
        options: 'All',
      });
      // A generated placeholder used to be returned when this failed. A
      // customer would have taken it to another registrar and been refused.
      if (!res.success || !res.data?.domsecret) {
        return NextResponse.json(
          {
            success: false,
            error: res.error || 'Upstream did not return an authorisation code for this domain.',
          },
          { status: 502 }
        );
      }
      return NextResponse.json({
        success: true,
        domainName: domain.domainName,
        authCode: res.data.domsecret,
      });
    }

    // 2. Modify Nameservers
    if (action === 'update-nameservers' && Array.isArray(nameservers)) {
      const nsClean = nameservers
        .map((n: any) => String(n || '').trim().toLowerCase())
        .filter(Boolean)
        .filter((n: string, i: number, all: string[]) => all.indexOf(n) === i);

      if (nsClean.length < 2) {
        return NextResponse.json(
          { success: false, error: 'At least 2 different nameservers are required' },
          { status: 400 }
        );
      }

      if (isLiveApiConfigured()) {
        const resolved = await resolveOrderId(domain);
        if ('error' in resolved) {
          return NextResponse.json({ success: false, error: resolved.error }, { status: 502 });
        }

        const res = await modifyNameservers(resolved.orderId, nsClean);
        if (!res.success) {
          // Nothing written locally: the registry is the record of truth and
          // it has not changed.
          return NextResponse.json(
            { success: false, error: res.error || 'The registry refused the nameserver change.' },
            { status: 502 }
          );
        }
      }

      await prisma.domain.update({
        where: { id: domain.id },
        data: { nameservers: nsClean.join(',') },
      });

      return NextResponse.json({
        success: true,
        message: `Nameservers for ${domain.domainName} updated to: ${nsClean.join(', ')}`,
        nameservers: nsClean,
      });
    }

    // 3. Toggle Theft Protection (Transfer Lock)
    if (action === 'toggle-theft-protection') {
      const locked = Boolean(theftProtection);

      if (isLiveApiConfigured()) {
        const resolved = await resolveOrderId(domain);
        if ('error' in resolved) {
          return NextResponse.json({ success: false, error: resolved.error }, { status: 502 });
        }

        const endpoint = locked
          ? '/domains/enable-theft-protection.json'
          : '/domains/disable-theft-protection.json';
        const res = await apiClient(endpoint, { 'order-id': resolved.orderId }, 'POST');
        if (!res.success) {
          return NextResponse.json(
            { success: false, error: res.error || 'The registry refused the transfer-lock change.' },
            { status: 502 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        theftProtection: locked,
        message: `Theft Protection (Registrar Lock) is now ${locked ? 'ENABLED' : 'DISABLED'}.`,
      });
    }

    // 4. Toggle Privacy Protection
    if (action === 'toggle-privacy-protection') {
      const enabled = Boolean(privacyProtection);

      if (isLiveApiConfigured()) {
        const resolved = await resolveOrderId(domain);
        if ('error' in resolved) {
          return NextResponse.json({ success: false, error: resolved.error }, { status: 502 });
        }

        const res = await apiClient(
          '/domains/modify-privacy-protection.json',
          {
            'order-id': resolved.orderId,
            'protect-privacy': enabled ? 'true' : 'false',
            // A documented REQUIRED parameter. Omitting it is rejected.
            reason: enabled
              ? 'Customer enabled WHOIS privacy from the control panel.'
              : 'Customer disabled WHOIS privacy from the control panel.',
          },
          'POST'
        );
        if (!res.success) {
          return NextResponse.json(
            { success: false, error: res.error || 'The registry refused the privacy change.' },
            { status: 502 }
          );
        }
      }

      await prisma.domain.update({
        where: { id: domain.id },
        data: { privacyEnabled: enabled },
      });

      return NextResponse.json({
        success: true,
        privacyProtection: enabled,
        message: `WHOIS Privacy Shield is now ${enabled ? 'PROTECTED' : 'PUBLIC'}.`,
      });
    }

    return NextResponse.json({ success: false, error: 'Unrecognized action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update domain configuration' },
      { status: 500 }
    );
  }
}
