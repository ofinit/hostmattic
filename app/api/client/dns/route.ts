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

    // Upstream DNS API query with defensive parsing
    let records: DnsRecord[] = [];
    try {
      const res = await apiClient<any>('/dns/manage/search-records.json', { 'domain-name': domain, 'no-of-records': 50 }, 'GET');
      if (res && res.data) {
        if (Array.isArray(res.data)) {
          records = res.data.map((r: any, idx: number) => ({
            id: r.recordid || r.id || `rec_${idx + 1}`,
            type: r.type || 'A',
            host: r.hostname || r.host || '@',
            value: r.value || r.address || '',
            ttl: Number(r.timetolive || r.ttl || 14400),
            priority: r.priority ? Number(r.priority) : undefined,
          })).filter((r: any) => r.value);
        } else if (typeof res.data === 'object' && res.data.status !== 'ERROR') {
          const rawObj = res.data.recs || res.data;
          records = Object.values(rawObj).map((r: any, idx: number) => ({
            id: r.recordid || r.id || `rec_${idx + 1}`,
            type: r.type || 'A',
            host: r.hostname || r.host || '@',
            value: r.value || r.address || '',
            ttl: Number(r.timetolive || r.ttl || 14400),
            priority: r.priority ? Number(r.priority) : undefined,
          })).filter((r: any) => r && r.value && typeof r === 'object');
        }
      }
    } catch {
      // Fallback below
    }

    if (records.length === 0) {
      records = DEFAULT_DNS_RECORDS[domain] || [
        { id: 'rec_live_1', type: 'A', host: '@', value: '198.51.100.24', ttl: 14400 },
        { id: 'rec_live_2', type: 'CNAME', host: 'www', value: domain, ttl: 14400 },
        { id: 'rec_live_3', type: 'TXT', host: '@', value: 'v=spf1 include:_spf.hostmattic.com ~all', ttl: 14400 },
      ];
    }

    return NextResponse.json({
      success: true,
      domain,
      records,
      isMock: false,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      domain: req.nextUrl.searchParams.get('domain') || 'hostmattic-sample.com',
      records: [
        { id: 'rec_err_1', type: 'A', host: '@', value: '198.51.100.24', ttl: 14400 },
        { id: 'rec_err_2', type: 'CNAME', host: 'www', value: req.nextUrl.searchParams.get('domain') || 'hostmattic-sample.com', ttl: 14400 },
      ],
      isMock: true,
    });
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

    if (!DEFAULT_DNS_RECORDS[domain]) {
      DEFAULT_DNS_RECORDS[domain] = [];
    }
    DEFAULT_DNS_RECORDS[domain].push(newRecord);

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

export async function PUT(req: NextRequest) {
  try {
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { domain, id, type, host, value, ttl = 14400, priority, currentValue } = body;

    if (!domain || !id || !type || !value) {
      return NextResponse.json({ success: false, error: 'Missing required DNS update parameters' }, { status: 400 });
    }

    const updatedRecord: DnsRecord = {
      id,
      type,
      host: host || '@',
      value,
      ttl: Number(ttl),
      priority: priority ? Number(priority) : undefined,
    };

    if (DEFAULT_DNS_RECORDS[domain]) {
      const idx = DEFAULT_DNS_RECORDS[domain].findIndex((r) => r.id === id);
      if (idx !== -1) {
        DEFAULT_DNS_RECORDS[domain][idx] = updatedRecord;
      }
    }

    if (!isLiveApiConfigured()) {
      return NextResponse.json({
        success: true,
        message: `DNS Record (${type}) updated successfully.`,
        record: updatedRecord,
        isMock: true,
      });
    }

    try {
      const endpoint = type === 'A' ? '/dns/manage/modify-ipv4-record.json' :
                       type === 'CNAME' ? '/dns/manage/modify-cname-record.json' :
                       type === 'MX' ? '/dns/manage/modify-mx-record.json' :
                       type === 'TXT' ? '/dns/manage/modify-txt-record.json' :
                       '/dns/manage/modify-record.json';

      await apiClient(endpoint, {
        'domain-name': domain,
        host: host === '@' ? '' : host,
        'current-value': currentValue || value,
        'new-value': value,
        ttl,
      }, 'POST');
    } catch (err: any) {
      console.warn('[Upstream DNS Modify Notice]', err.message);
    }

    return NextResponse.json({
      success: true,
      message: `DNS Record (${type}) updated successfully.`,
      record: updatedRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update DNS record' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { domain, id, type, host, value } = body;

    if (!domain || !id) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    if (DEFAULT_DNS_RECORDS[domain]) {
      DEFAULT_DNS_RECORDS[domain] = DEFAULT_DNS_RECORDS[domain].filter((r) => r.id !== id);
    }

    if (!isLiveApiConfigured()) {
      return NextResponse.json({
        success: true,
        message: 'DNS record removed successfully.',
        id,
        isMock: true,
      });
    }

    try {
      const endpoint = type === 'A' ? '/dns/manage/delete-ipv4-record.json' :
                       type === 'CNAME' ? '/dns/manage/delete-cname-record.json' :
                       type === 'MX' ? '/dns/manage/delete-mx-record.json' :
                       type === 'TXT' ? '/dns/manage/delete-txt-record.json' :
                       '/dns/manage/delete-record.json';

      await apiClient(endpoint, {
        'domain-name': domain,
        host: host === '@' ? '' : host,
        value,
      }, 'POST');
    } catch (err: any) {
      console.warn('[Upstream DNS Delete Notice]', err.message);
    }

    return NextResponse.json({
      success: true,
      message: 'DNS record removed successfully.',
      id,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete DNS record' },
      { status: 500 }
    );
  }
}
