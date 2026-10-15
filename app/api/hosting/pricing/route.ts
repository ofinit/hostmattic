import { NextRequest, NextResponse } from 'next/server';
import { getLiveHostingPricing, PRODUCT_KEYS, PlanPricing } from '@/lib/api/hostingPricing';

export const dynamic = 'force-dynamic';

/**
 * Statuses upstream uses for a plan that cannot be ordered.
 *
 * Most products do not report a status at all - of nineteen families only
 * shared Linux and shared Windows do - so requiring status === 'Active'
 * withheld sixteen families that were perfectly sellable. A plan is treated as
 * orderable unless upstream explicitly says otherwise; being in the customer
 * price catalogue is itself the evidence that it is on sale.
 */
const UNSELLABLE_STATUSES = ['paused', 'deleted', 'inactive', 'discontinued', 'suspended'];

function sellableOnly(plans: Record<string, PlanPricing> | undefined) {
  const out: Record<string, PlanPricing> = {};
  if (!plans) return out;
  for (const [name, plan] of Object.entries(plans)) {
    if (!UNSELLABLE_STATUSES.includes(String(plan.status).toLowerCase())) out[name] = plan;
  }
  return out;
}

/**
 * GET /api/hosting/pricing                       all product families
 * GET /api/hosting/pricing?type=SHARED_LINUX     one family
 *
 * Returns only plans that are actually sellable. A plan upstream has paused
 * cannot be provisioned, so quoting a price for it would take money for
 * something the order would then fail to deliver.
 *
 * Anything absent from the response leaves the caller on its own published
 * figures - a page must never render a price this app invented.
 */
export async function GET(req: NextRequest) {
  try {
    const type = req.nextUrl.searchParams.get('type')?.toUpperCase() || '';
    const all = await getLiveHostingPricing();

    if (type) {
      const known = Object.prototype.hasOwnProperty.call(PRODUCT_KEYS, type);
      const plans = sellableOnly(all[type]);
      const withheld = Object.values(all[type] || {})
        .filter((p) => UNSELLABLE_STATUSES.includes(String(p.status).toLowerCase()))
        .map((p) => ({ plan: p.planName, status: p.status }));

      return NextResponse.json({
        success: true,
        productType: type,
        known,
        live: Object.keys(plans).length > 0,
        plans,
        withheld,
      });
    }

    const pricing: Record<string, Record<string, PlanPricing>> = {};
    for (const family of Object.keys(all)) {
      const plans = sellableOnly(all[family]);
      if (Object.keys(plans).length) pricing[family] = plans;
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      families: Object.keys(pricing),
      pricing,
    });
  } catch (error: any) {
    console.error('Error fetching hosting pricing:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch live plan pricing' },
      { status: 500 }
    );
  }
}
