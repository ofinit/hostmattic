/**
 * Live plan pricing for every product family that is not a domain.
 *
 * Domain pricing (lib/api/pricing.ts) has been live for a while; every other
 * family carried its prices in the page source, so a cost change upstream was
 * invisible until someone checked the margin by hand.
 *
 * Shape, confirmed against the live catalogue through
 * /api/admin/pricing-diagnostics rather than assumed:
 *
 *   "singledomainhostinglinuxus": {
 *     "plans": {
 *       "1682": { "add": { "1": 30, "3": 30, "6": 30, "12": 30, ... } }
 *     }
 *   }
 *
 * Two consequences drive the code below:
 *
 *  - plans sit under a `plans` wrapper and are keyed by NUMERIC PLAN ID, not
 *    by name, so a product's plan names must be fetched separately before a
 *    price can be attached to "Starter" rather than to "1682";
 *  - the duration keys (1/3/6/12/24/36) are MONTHS, and the value is the
 *    per-month rate for that tenure slab, not the total for the term. A
 *    product priced identically at every tenure, as acronis is, only makes
 *    sense read that way.
 */

import { apiClient, isLiveApiConfigured } from './client';

const USD_INR_RATE = 83.5;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface PlanPricing {
  /** Per-month rate when billed monthly. */
  monthlyUsd?: number;
  /** Per-month rate when committing to a year. */
  annualMonthlyUsd?: number;
  /** What a year costs in total at the annual rate. */
  annualUsd?: number;
  /** Our own cost, for margin reporting. */
  wholesaleMonthlyUsd?: number;
  /** Upstream plan id, for provisioning and for tracing a price back. */
  planId: string;
  source: 'live';
}

/** productType -> plan name -> pricing */
export type HostingPricingMap = Record<string, Record<string, PlanPricing>>;

/**
 * Upstream product keys per product family, confirmed present in the live
 * catalogue. Listed in preference order: a reseller may carry only some
 * regions, so the first key that exists wins.
 */
export const PRODUCT_KEYS: Record<string, string[]> = {
  SHARED_LINUX: [
    'singledomainhostinglinuxus',
    'singledomainhostinglinuxin',
    'singledomainhostinglinuxhk',
  ],
  SHARED_WINDOWS: [
    'singledomainhostingwindowsus',
    'singledomainhostingwindowsin',
    'singledomainhostingwindowsuk',
    'singledomainhostingwindowshk',
  ],
  MULTI_DOMAIN: [
    'multidomainhosting',
    'multidomainhostinglinuxin',
    'multidomainhostinglinuxhk',
  ],
  MULTI_DOMAIN_WINDOWS: [
    'multidomainwindowshosting',
    'multidomainwindowshostingin',
    'multidomainwindowshostinghk',
  ],
  BUSINESS_HOSTING: ['businesshostinglinuxus', 'businesshostinglinuxin'],
  WORDPRESS: ['wordpresshostingusa', 'wordpresshostingindia'],
  CLOUD: ['cloudsiteslinuxus', 'cloudsiteslinuxin'],
  RESELLER: ['resellerhosting', 'resellerhostinglinuxin', 'resellerhostinglinuxuk'],
  RESELLER_WINDOWS: [
    'resellerwindowshosting',
    'resellerwindowshostingin',
    'resellerwindowshostinguk',
  ],
  VPS: ['virtualserverlinuxus', 'virtualserverlinuxin'],
  DEDICATED: [
    'dedicatedserverlinuxus',
    'dedicatedserverwindowsin',
    'bluehostdedicatedserverlinuxus',
  ],
  EMAIL_BUSINESS: ['eeliteus', 'enterpriseemailus', 'titanmailglobal', 'titanmailindia'],
  EMAIL_GOOGLE: ['gappsgbl', 'gappsin', 'gappsse'],
  SECURITY_SITELOCK: ['sitelock'],
  SECURITY_CODEGUARD: ['codeguard'],
  SECURITY_ACRONIS: ['acronisbackupus', 'acronisbackupasia'],
  SECURITY_SSL: ['sslcert'],
  TOOLS_BUILDER: ['weebly'],
  COMBO_PLANS: ['productbundle'],
};

let cache: HostingPricingMap | null = null;
let cacheExpiry = 0;

/** Plan-name lookups are per product key and change rarely. */
const planNameCache = new Map<string, Record<string, string>>();

/**
 * Upstream exposes plan metadata under more than one path depending on the
 * product. Try each; the first that yields names wins.
 */
const PLAN_DETAIL_ENDPOINTS = ['/products/plan-details.json', '/products/details.json'];

export function extractPlanNames(payload: any): Record<string, string> {
  const names: Record<string, string> = {};
  if (!payload || typeof payload !== 'object') return names;

  const root = payload.plans && typeof payload.plans === 'object' ? payload.plans : payload;

  for (const [planId, detail] of Object.entries<any>(root)) {
    if (!detail || typeof detail !== 'object') continue;
    const name =
      detail.plan_name ??
      detail.planname ??
      detail.name ??
      detail.plan_description ??
      detail?.plan?.name;
    if (typeof name === 'string' && name.trim()) names[planId] = name.trim();
  }
  return names;
}

export async function getPlanNames(productKey: string): Promise<Record<string, string>> {
  const cached = planNameCache.get(productKey);
  if (cached) return cached;

  for (const endpoint of PLAN_DETAIL_ENDPOINTS) {
    try {
      const res = await apiClient<any>(endpoint, { 'product-key': productKey }, 'GET');
      if (!res.success || !res.data) continue;
      const names = extractPlanNames(res.data);
      if (Object.keys(names).length) {
        planNameCache.set(productKey, names);
        return names;
      }
    } catch {
      // Try the next path.
    }
  }

  planNameCache.set(productKey, {});
  return {};
}

function num(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const toUsd = (inr: number) => Number((inr / USD_INR_RATE).toFixed(2));

export async function getLiveHostingPricing(): Promise<HostingPricingMap> {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;
  if (!isLiveApiConfigured()) return {};

  try {
    const [customerRes, costRes] = await Promise.all([
      apiClient<Record<string, any>>('/products/customer-price.json', {}, 'GET'),
      apiClient<Record<string, any>>('/products/reseller-cost-price.json', {}, 'GET'),
    ]);

    const customerPrices = customerRes.success && customerRes.data ? customerRes.data : {};
    const costs = costRes.success && costRes.data ? costRes.data : {};

    const result: HostingPricingMap = {};
    const unnamed: string[] = [];
    const missing: string[] = [];

    for (const [productType, keys] of Object.entries(PRODUCT_KEYS)) {
      const productKey = keys.find((k) =>
        Object.prototype.hasOwnProperty.call(customerPrices, k)
      );
      if (!productKey) {
        missing.push(productType);
        continue;
      }

      const plans = customerPrices[productKey]?.plans;
      if (!plans || typeof plans !== 'object') {
        missing.push(productType);
        continue;
      }

      const costPlans = costs[productKey]?.plans || {};
      const names = await getPlanNames(productKey);

      const forType: Record<string, PlanPricing> = {};

      for (const [planId, node] of Object.entries<any>(plans)) {
        const name = names[planId];
        // Without a name there is nothing to attach the price to. Matching by
        // position would silently put the Business Pro price on Starter.
        if (!name) continue;

        const monthly = num(node?.add?.['1']);
        const annualMonthly = num(node?.add?.['12']);
        const costMonthly = num(costPlans?.[planId]?.add?.['1']);

        if (!monthly && !annualMonthly) continue;

        // Per-month rates fall as tenure lengthens; they never rise. A yearly
        // rate above the monthly one means the value is not what we think it
        // is, so drop it rather than publish it.
        const annualUsable =
          annualMonthly && (!monthly || annualMonthly <= monthly) ? annualMonthly : undefined;

        forType[name] = {
          planId,
          monthlyUsd: monthly ? toUsd(monthly) : undefined,
          annualMonthlyUsd: annualUsable ? toUsd(annualUsable) : undefined,
          annualUsd: annualUsable ? toUsd(annualUsable * 12) : undefined,
          wholesaleMonthlyUsd: costMonthly ? toUsd(costMonthly) : undefined,
          source: 'live',
        };
      }

      if (Object.keys(forType).length) result[productType] = forType;
      else if (Object.keys(plans).length) unnamed.push(`${productType}(${productKey})`);
      else missing.push(productType);
    }

    console.log(
      `[HostingPricing] priced ${Object.keys(result).length} families` +
        (unnamed.length ? `; plan names unavailable for: ${unnamed.join(', ')}` : '') +
        (missing.length ? `; not in catalogue: ${missing.join(', ')}` : '')
    );

    cache = result;
    cacheExpiry = now + CACHE_TTL_MS;
    return result;
  } catch (err: any) {
    console.warn('[HostingPricing] Could not fetch live plan pricing:', err?.message);
    return {};
  }
}
