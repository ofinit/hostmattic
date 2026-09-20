import { NextRequest, NextResponse } from 'next/server';
import { generateCustomerSsoToken } from '@/lib/api/customers';
import { requireAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // SECURITY: Require admin authentication — SSO token generation is admin-only
    const session = requireAdmin(req);
    if (session instanceof NextResponse) return session;

    const customerId = req.nextUrl.searchParams.get('customerId') || req.nextUrl.searchParams.get('customer-id');

    if (!customerId || customerId === '1001' || customerId === 'Pending Sync') {
      return NextResponse.json(
        { success: false, error: 'A valid upstream Customer ID is required for Single Sign-On (SSO).' },
        { status: 400 }
      );
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    let clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || '223.185.26.53');
    if (!clientIp || clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.startsWith('192.168.') || clientIp.startsWith('10.')) {
      clientIp = '223.185.26.53';
    }

    const ssoRes = await generateCustomerSsoToken(customerId, clientIp);

    if (ssoRes.success && ssoRes.data?.redirectUrl) {
      return NextResponse.redirect(ssoRes.data.redirectUrl);
    }

    return NextResponse.json(
      { success: false, error: ssoRes.error || 'Failed to generate SSO token' },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'SSO redirection failed' },
      { status: 500 }
    );
  }
}
