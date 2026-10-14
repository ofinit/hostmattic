import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiClient, isLiveApiConfigured } from '@/lib/api/client';
import { PRODUCT_KEY_CANDIDATES } from '@/lib/api/hostingPricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/pricing-diagnostics
 * GET /api/admin/pricing-diagnostics?key=<upstream product key>
 *
 * Shows what the upstream price catalogue actually contains.
 *
 * Plan-based products (hosting, servers, email, security) are not documented
 * in a form that can be verified ahead of time, and the product keys a
 * reseller is given differ by which products they signed up for. So rather
 * than guess, this reports the real keys and the real nesting, and
 * `lib/api/hostingPricing.ts` is then made exact against it.
 *
 * Administrators only: upstream key names are not customer-facing.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  if (!isLiveApiConfigured()) {
    return NextResponse.json({
      success: false,
      configured: false,
      error:
        'Upstream API credentials are not set on this deployment, so no catalogue can be read.',
    });
  }

  try {
    const [customerRes, costRes] = await Promise.all([
      apiClient<Record<string, any>>('/products/customer-price.json', {}, 'GET'),
      apiClient<Record<string, any>>('/products/reseller-cost-price.json', {}, 'GET'),
    ]);

    const customerPrices =
      customerRes.success && customerRes.data ? customerRes.data : {};
    const costs = costRes.success && costRes.data ? costRes.data : {};
    const allKeys = Object.keys(customerPrices).sort();

    // One specific key: dump its shape so the parser can be written against it.
    const key = req.nextUrl.searchParams.get('key');
    if (key) {
      return NextResponse.json({
        success: true,
        key,
        present: Object.prototype.hasOwnProperty.call(customerPrices, key),
        customerPrice: customerPrices[key] ?? null,
        resellerCost: costs[key] ?? null,
      });
    }

    // Domain keys are already mapped and understood; set them aside so what
    // remains is the plan-based catalogue we still need to identify.
    const domainish = allKeys.filter((k) => /^dot|^domcno$|^centralnic/i.test(k));
    const planLike = allKeys.filter((k) => !domainish.includes(k));

    // Which of the guessed candidates actually exist.
    const candidateHits: Record<string, string | null> = {};
    for (const [type, candidates] of Object.entries(PRODUCT_KEY_CANDIDATES)) {
      candidateHits[type] =
        candidates.find((c) =>
          Object.prototype.hasOwnProperty.call(customerPrices, c)
        ) ?? null;
    }

    // A sample of the nesting under one plan-like key, so the shape is visible
    // without having to request each key individually.
    const sampleKey = planLike[0];
    const sample = sampleKey
      ? { key: sampleKey, customerPrice: customerPrices[sampleKey] }
      : null;

    return NextResponse.json({
      success: true,
      configured: true,
      counts: {
        total: allKeys.length,
        domainLike: domainish.length,
        planLike: planLike.length,
      },
      planLikeKeys: planLike,
      candidateHits,
      sample,
      note:
        'Open ?key=<one of planLikeKeys> to see that product\'s full pricing shape.',
    });
  } catch (error: any) {
    console.error('Pricing diagnostics error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not read the upstream catalogue.' },
      { status: 500 }
    );
  }
}
