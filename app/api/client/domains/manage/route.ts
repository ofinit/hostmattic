import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLiveApiConfigured, apiClient } from '@/lib/api/client';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { domainName, action, nameservers, theftProtection, privacyProtection } = body;

    if (!domainName) {
      return NextResponse.json({ success: false, error: 'Domain name is required' }, { status: 400 });
    }

    // 1. Get Auth / EPP Code
    if (action === 'get-auth-code') {
      let authCode = 'HM@' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!99';
      if (isLiveApiConfigured()) {
        const res = await apiClient<any>('/domains/details-by-name.json', { 'domain-name': domainName, options: 'All' });
        if (res.success && res.data?.domsecret) {
          authCode = res.data.domsecret;
        }
      }
      return NextResponse.json({ success: true, domainName, authCode });
    }

    // 2. Modify Nameservers
    if (action === 'update-nameservers' && Array.isArray(nameservers)) {
      const nsClean = nameservers.filter(Boolean);
      if (nsClean.length < 2) {
        return NextResponse.json({ success: false, error: 'At least 2 nameservers are required' }, { status: 400 });
      }

      try {
        await prisma.domain.updateMany({
          where: { domainName },
          data: { nameservers: nsClean.join(',') },
        });
      } catch (dbErr) {
        // demo fallback
      }

      if (isLiveApiConfigured()) {
        const postData: Record<string, any> = { 'domain-name': domainName };
        nsClean.forEach((ns, i) => {
          postData[`ns${i + 1}`] = ns;
        });
        await apiClient('/domains/modify-ns.json', postData, 'POST');
      }

      return NextResponse.json({
        success: true,
        message: `Nameservers for ${domainName} updated to: ${nsClean.join(', ')}`,
        nameservers: nsClean,
      });
    }

    // 3. Toggle Theft Protection (Transfer Lock)
    if (action === 'toggle-theft-protection') {
      const locked = Boolean(theftProtection);

      if (isLiveApiConfigured()) {
        const endpoint = locked
          ? '/domains/enable-theft-protection.json'
          : '/domains/disable-theft-protection.json';
        await apiClient(endpoint, { 'domain-name': domainName }, 'POST');
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

      try {
        await prisma.domain.updateMany({
          where: { domainName },
          data: { privacyEnabled: enabled },
        });
      } catch (dbErr) {}

      if (isLiveApiConfigured()) {
        await apiClient('/domains/modify-privacy-protection.json', {
          'domain-name': domainName,
          'protect-privacy': enabled ? 'true' : 'false',
        }, 'POST');
      }

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
