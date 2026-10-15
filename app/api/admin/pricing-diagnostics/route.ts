import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { apiClient, isLiveApiConfigured } from '@/lib/api/client';
import { PRODUCT_KEYS, extractPlanDetails, getLiveHostingPricing } from '@/lib/api/hostingPricing';
import { TLD_TO_PRODUCT_KEY } from '@/lib/api/pricing';

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

    // Audit: every product key this app maps, checked against the catalogue.
    //
    // .co.in was mapped to `dotcoin`, which does not exist, so it matched
    // nothing and silently fell back to the static table for over a year. The
    // only way to catch that class of mistake is to check every mapping at
    // once rather than wait for someone to notice a wrong price.
    if (req.nextUrl.searchParams.get('audit')) {
      const [customerRes, costRes] = await Promise.all([
        apiClient<Record<string, any>>('/products/customer-price.json', {}, 'GET'),
        apiClient<Record<string, any>>('/products/reseller-cost-price.json', {}, 'GET'),
      ]);

      const customerPrices = customerRes.success && customerRes.data ? customerRes.data : {};
      const costs = costRes.success && costRes.data ? costRes.data : {};
      const has = (k: string) => Object.prototype.hasOwnProperty.call(customerPrices, k);

      const brokenDomains: { tld: string; productKey: string }[] = [];
      const pricedDomains: { tld: string; productKey: string; add?: number; renew?: number; transfer?: number }[] = [];

      const readAction = (node: any, action: string) => {
        const v = node?.[action]?.['1'] ?? node?.['0']?.pricing?.[action]?.['1'];
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : undefined;
      };

      for (const [tld, key] of Object.entries(TLD_TO_PRODUCT_KEY)) {
        if (!has(key)) {
          brokenDomains.push({ tld, productKey: key });
          continue;
        }
        const node = customerPrices[key];
        pricedDomains.push({
          tld,
          productKey: key,
          add: readAction(node, 'addnewdomain'),
          renew: readAction(node, 'renewdomain'),
          transfer: readAction(node, 'addtransferdomain') ?? readAction(node, 'transferdomain'),
        });
      }

      const brokenFamilies: string[] = [];
      const okFamilies: { family: string; productKey: string }[] = [];
      for (const [family, candidates] of Object.entries(PRODUCT_KEYS)) {
        const hit = candidates.find(has);
        if (hit) okFamilies.push({ family, productKey: hit });
        else brokenFamilies.push(family);
      }

      // Products that are priced upstream but that nothing in this app sells.
      const claimed = new Set<string>([
        ...Object.values(TLD_TO_PRODUCT_KEY),
        ...okFamilies.map((f) => f.productKey),
      ]);
      const unsold = Object.keys(customerPrices)
        .filter((k) => !claimed.has(k))
        .sort();

      return NextResponse.json({
        success: true,
        summary: {
          upstreamProducts: Object.keys(customerPrices).length,
          domainsMapped: Object.keys(TLD_TO_PRODUCT_KEY).length,
          domainsBroken: brokenDomains.length,
          familiesMapped: okFamilies.length,
          familiesBroken: brokenFamilies.length,
          notSold: unsold.length,
        },
        // Mapped to a product key the catalogue does not contain: these price
        // from the static table and are almost certainly wrong.
        brokenDomains,
        brokenFamilies,
        pricedDomains,
        okFamilies,
        notSold: unsold,
        costKeysPresent: Object.keys(costs).length,
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
