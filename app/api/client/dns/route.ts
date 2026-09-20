import { NextRequest, NextResponse } from 'next/server';
import { isLiveApiConfigured, apiClient } from '@/lib/api/client';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export interface DnsRecord {
  id: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT' | 'AAAA' | 'NS';
  host: string;
  value: string;
  ttl: number;
  priority?: number;
}

const DEFAULT_DNS_RECORDS: Record<string, DnsRecord[]> = {
  'hostmattic-sample.com': [
    { id: 'rec_1', type: 'A', host: '@', value: '198.51.100.24', ttl: 14400 },
    { id: 'rec_2', type: 'A', host: 'mail', value: '198.51.100.24', ttl: 14400 },
    { id: 'rec_3', type: 'CNAME', host: 'www', value: 'hostmattic-sample.com', ttl: 14400 },
    { id: 'rec_4', type: 'MX', host: '@', value: 'mail.hostmattic-sample.com', ttl: 14400, priority: 10 },
    { id: 'rec_5', type: 'TXT', host: '@', value: 'v=spf1 a mx ip4:198.51.100.24 ~all', ttl: 14400 },
  ],
};

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const domain = req.nextUrl.searchParams.get('domain') || 'hostmattic-sample.com';

    if (!isLiveApiConfigured()) {
      const records = DEFAULT_DNS_RECORDS[domain] || [
        { id: 'rec_default_1', type: 'A', host: '@', value: '198.51.100.24', ttl: 14400 },
        { id: 'rec_default_2', type: 'CNAME', host: 'www', value: domain, ttl: 14400 },
        { id: 'rec_default_3', type: 'TXT', host: '@', value: 'v=spf1 include:_spf.hostmattic.com ~all', ttl: 14400 },
      ];

      return NextResponse.json({
        success: true,
        domain,
        records,
        nameservers: ['ns1.hostmattic.com', 'ns2.hostmattic.com'],
        isMock: true,
      });
    }

    // Upstream DNS API query
    const res = await apiClient<any>('/dns/manage/search-records.json', { 'domain-name': domain, 'no-of-records': 50 }, 'GET');
    return NextResponse.json({
      success: true,
      domain,
      records: res.data || [],
      isMock: false,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve DNS zone' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { domain, type, host, value, ttl = 14400, priority } = body;

    if (!domain || !type || !value) {
      return NextResponse.json({ success: false, error: 'Missing required DNS record parameters' }, { status: 400 });
    }

    const newRecord: DnsRecord = {
      id: 'rec_' + Math.random().toString(36).substring(2, 9),
      type,
      host: host || '@',
      value,
      ttl: Number(ttl),
      priority: priority ? Number(priority) : undefined,
    };

    if (!isLiveApiConfigured()) {
      return NextResponse.json({
        success: true,
        message: `DNS Record (${type}) for ${domain} applied successfully.`,
        record: newRecord,
        isMock: true,
      });
    }

    // Call upstream /dns/manage/add-record.json
    const res = await apiClient('/dns/manage/add-record.json', {
      'domain-name': domain,
      type,
      host,
      value,
      ttl,
    }, 'POST');

    return NextResponse.json({
      success: res.success,
      record: newRecord,
      error: res.error,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save DNS record' },
      { status: 500 }
    );
  }
}
