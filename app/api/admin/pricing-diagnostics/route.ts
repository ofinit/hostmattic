import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiClient, isLiveApiConfigured } from '@/lib/api/client';
import { PRODUCT_KEYS, extractPlanDetails, getLiveHostingPricing } from '@/lib/api/hostingPricing';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// /products/details.json ignores product-key and returns the whole domain
// catalogue, so only this path is worth probing.
const PLAN_DETAIL_ENDPOINTS = ['/products/plan-details.json'];

/**
 * GET /api/admin/pricing-diagnostics
 * GET /api/admin/pricing-diagnostics?key=<upstream product key>
 *
 * Shows what the upstream price catalogue actually contains, and what this app
 * makes of it.
 *
 * Plan-based products are keyed by numeric plan id with no name attached, and
 * the key set differs per reseller, so the mapping in lib/api/hostingPricing.ts
 * is written against this output rather than against an assumption.
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
      error: 'Upstream API credentials are not set on this deployment.',
    });
  }

  try {
    const key = req.nextUrl.searchParams.get('key');

    // One product: its prices, its cost, and whether plan names can be read.
    if (key) {
      const [customerRes, costRes] = await Promise.all([
        apiClient<Record<string, any>>('/products/customer-price.json', {}, 'GET'),
        apiClient<Record<string, any>>('/products/reseller-cost-price.json', {}, 'GET'),
      ]);

      const customerPrices = customerRes.success && customerRes.data ? customerRes.data : {};
      const costs = costRes.success && costRes.data ? costRes.data : {};

      // Probe each plan-details path so we can see which one answers.
      const planDetailProbes: Record<string, any> = {};
      for (const endpoint of PLAN_DETAIL_ENDPOINTS) {
        try {
          const res = await apiClient<any>(endpoint, { 'product-key': key }, 'GET');
          planDetailProbes[endpoint] = {
            ok: res.success,
            error: res.error ?? null,
            namesFound: Object.keys(extractPlanDetails(res.data, key)).length,
            names: extractPlanDetails(res.data, key),
            raw: res.success ? res.data : null,
          };
        } catch (e: any) {
          planDetailProbes[endpoint] = { ok: false, error: e?.message || 'threw' };
        }
      }

      return NextResponse.json({
        success: true,
        key,
        present: Object.prototype.hasOwnProperty.call(customerPrices, key),
        customerPrice: customerPrices[key] ?? null,
        resellerCost: costs[key] ?? null,
        planDetailProbes,
      });
    }

    // Overview: what the mapping currently resolves to, end to end.
    const customerRes = await apiClient<Record<string, any>>(
      '/products/customer-price.json',
      {},
      'GET'
    );
    const customerPrices = customerRes.success && customerRes.data ? customerRes.data : {};
    const allKeys = Object.keys(customerPrices).sort();

    const resolved: Record<string, any> = {};
    for (const [type, candidates] of Object.entries(PRODUCT_KEYS)) {
      const hit = candidates.find((c) =>
        Object.prototype.hasOwnProperty.call(customerPrices, c)
      );
      resolved[type] = {
        productKey: hit ?? null,
        planIds: hit ? Object.keys(customerPrices[hit]?.plans || {}) : [],
      };
    }

    // The real answer: what actually came out, with names attached.
    const priced = await getLiveHostingPricing();

    return NextResponse.json({
      success: true,
      configured: true,
      totalKeys: allKeys.length,
      resolved,
      pricedFamilies: Object.keys(priced),
      priced,
      note: 'Open ?key=<product key> for one product’s full shape and plan-name probe.',
    });
  } catch (error: any) {
    console.error('Pricing diagnostics error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Could not read the upstream catalogue.' },
      { status: 500 }
    );
  }
}
