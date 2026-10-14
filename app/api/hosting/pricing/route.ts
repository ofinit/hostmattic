import { NextRequest, NextResponse } from 'next/server';
import { getLiveHostingPricing, PRODUCT_KEYS } from '@/lib/api/hostingPricing';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hosting/pricing            all product families
 * GET /api/hosting/pricing?type=SHARED_LINUX   one family
 *
 * Returns only what upstream actually priced. A family that could not be
 * matched is simply absent, and the caller keeps its own published figures -
 * a page must never render a price this app invented.
 */
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type')?.toUpperCase() || '';
    const all = await getLiveHostingPricing();

    if (type) {
      const known = Object.prototype.hasOwnProperty.call(PRODUCT_KEYS, type);
      return NextResponse.json({
        success: true,
        productType: type,
        known,
        live: Boolean(all[type]),
        plans: all[type] || {},
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      families: Object.keys(all),
      pricing: all,
    });
  } catch (error: any) {
    console.error('Error fetching hosting pricing:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch live plan pricing' },
      { status: 500 }
    );
  }
}
