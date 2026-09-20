import { NextRequest, NextResponse } from 'next/server';
import { checkDomainAvailability } from '@/lib/api/domains';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const tldsParam = searchParams.get('tlds');

    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Query param "domain" is required' },
        { status: 400 }
      );
    }

    const tlds = tldsParam
      ? tldsParam.split(',').map((t) => (t.startsWith('.') ? t : `.${t}`))
      : ['.com', '.in', '.net', '.org', '.tech', '.online', '.store', '.io'];

    const results = await checkDomainAvailability(domain, tlds);

    return NextResponse.json({
      success: true,
      query: domain,
      results,
    });
  } catch (error: any) {
    console.error('Domain check GET error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Domain check failed' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, tlds } = body;

    if (!domain || typeof domain !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid domain name' },
        { status: 400 }
      );
    }

    const requestedTlds = Array.isArray(tlds) && tlds.length > 0
      ? tlds
      : ['.com', '.in', '.net', '.org', '.tech', '.online', '.store', '.io'];

    const results = await checkDomainAvailability(domain, requestedTlds);

    return NextResponse.json({
      success: true,
      query: domain,
      results,
    });
  } catch (error: any) {
    console.error('Domain check route error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Domain check failed' },
      { status: 500 }
    );
  }
}
