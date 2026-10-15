/**
 * Live plan pricing for every product family that is not a domain.
 *
 * Shapes below are confirmed against the live catalogue through
 * /api/admin/pricing-diagnostics, not assumed. They are not uniform, and the
 * variations are the whole difficulty:
 *
 * customer-price.json, plan ids at the top level (shared hosting):
 *   "singledomainhostinglinuxus": {
 *     "7293195": { "add": { "12": 108, "24": 108 }, "renew": { "12": 228 }, "ssl": 500 }
 *   }
 *
 * customer-price.json, wrapped in `plans` (acronis):
 *   "acronisbackupasia": { "plans": { "1682": { "add": { "1": 30, ... } } } }
 *
 * reseller-cost-price.json, nested under the product key AGAIN and keyed by
 * BAND id rather than plan id, with a flat price per action:
 *   "singledomainhostinglinuxus": {
 *     "singledomainhostinglinuxus": {
 *       "89": { "pricing": { "add": 90, "renew": 190, "ssl": 250 },
 *               "description": { "webspace": 20480, ... } }
 *     }
 *   }
 *
 * plan-details.json, nested under the product key, carrying the name, the
 * sellable status and the band id that joins price to cost:
 *   "singledomainhostinglinuxus": {
 *     "7293195": { "plan_name": "Standard", "status": "Active", "bandid": "89" }
 *   }
 *
 * Two facts about the numbers themselves:
 *
 *  - duration keys are MONTHS and the value is the per-month rate for that
 *    tenure, not the total for the term. A plan charging 108 at 12, 24 and 36
 *    months only reads that way; as totals, three years would cost what one
 *    does.
 *  - `add` is the first-term rate and `renew` is the ongoing one, and they
 *    differ sharply (108 against 228). They are kept separate here for the
 *    same reason they are for domains: quoting a promotional rate as a
 *    renewal once shipped renewals below wholesale.
 */

import { apiClient, isLiveApiConfigured } from './client';

const USD_INR_RATE = 83.5;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface PlanPricing {
  planId: string;
  planName: string;
  bandId?: string;
  /** Upstream status; only "Active" plans can actually be provisioned. */
  status: string;
  /** Shortest tenure upstream will sell, in months. */
  minTenureMonths: number;
  /** What upstream actually provisions, for checking advertised copy. */
  webspaceMb?: number;
  mailAccounts?: number;
  /** Per-month rate month-to-month, when upstream sells a 1-month tenure. */
  monthlyUsd?: number;
  /** Per-month rate on a 12-month tenure. */
  annualMonthlyUsd?: number;
  /** Per-month RENEWAL rate on a 12-month tenure - not the same as above. */
  renewMonthlyUsd?: number;
  /** Our own per-month cost, for margin. */
  wholesaleMonthlyUsd?: number;
  wholesaleRenewMonthlyUsd?: number;
  /**
   * A superseded generation that upstream still prices, e.g. "Classic 2026
   * Starter" alongside the current "Starter", often at a different price.
   * Kept in the map so the admin console can see it, but withheld from the
   * storefront: selling last year's plan by accident is a silent margin leak.
   */
  isLegacy: boolean;
  source: 'live';
}

/** "Classic 2025", "Classic 2026" and the like mark a superseded generation. */
export function isLegacyPlanName(name: string): boolean {
  return /\bclassic\s*20\d{2}\b/i.test(name);
}

/** productType -> plan name -> pricing */
export type HostingPricingMap = Record<string, Record<string, PlanPricing>>;

/**
 * Upstream product keys per family, confirmed present in the live catalogue.
 * Preference order: a reseller may carry only some regions, first hit wins.
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
  MULTI_DOMAIN: ['multidomainhosting', 'multidomainhostinglinuxin', 'multidomainhostinglinuxhk'],
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

export interface PlanDetail {
  name: string;
  status: string;
  bandId?: string;
  /** Upstream webspace in MB; -1 means unmetered. */
  webspaceMb?: number;
  /** Upstream mailbox allowance; -1 means unmetered. */
  mailAccounts?: number;
}

const planDetailCache = new Map<string, Record<string, PlanDetail>>();

/**
 * Only plan-details.json is useful here. /products/details.json ignores
 * product-key and returns the entire domain catalogue instead, so it is not
 * worth the request.
 */
export function extractPlanDetails(payload: any, productKey: string): Record<string, PlanDetail> {
  const out: Record<string, PlanDetail> = {};
  if (!payload || typeof payload !== 'object') return out;

  // Nested under the product key, with the bare object as a fallback.
  const root =
    (payload[productKey] && typeof payload[productKey] === 'object' && payload[productKey]) ||
    (payload.plans && typeof payload.plans === 'object' && payload.plans) ||
    payload;

  for (const [planId, detail] of Object.entries<any>(root)) {
    if (!detail || typeof detail !== 'object') continue;
    const name = detail.plan_name ?? detail.planname ?? detail.name;
    if (typeof name !== 'string' || !name.trim()) continue;
    const toInt = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    out[planId] = {
      name: name.trim(),
      status: String(detail.status ?? 'Unknown'),
      bandId: detail.bandid != null ? String(detail.bandid) : undefined,
      webspaceMb: toInt(detail.webspace),
      mailAccounts: toInt(detail.no_of_mail_accounts),
    };
  }
  return out;
}

export async function getPlanDetails(productKey: string): Promise<Record<string, PlanDetail>> {
  const cached = planDetailCache.get(productKey);
  if (cached) return cached;

  try {
    const res = await apiClient<any>('/products/plan-details.json', { 'product-key': productKey }, 'GET');
    const details = res.success ? extractPlanDetails(res.data, productKey) : {};
    planDetailCache.set(productKey, details);
    return details;
  } catch {
    planDetailCache.set(productKey, {});
    return {};
  }
}

function num(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const toUsd = (inr: number) => Number((inr / USD_INR_RATE).toFixed(2));

/** Plan ids sit either directly under the product key or inside `plans`. */
function planNodes(productNode: any): Record<string, any> {
  if (!productNode || typeof productNode !== 'object') return {};
  if (productNode.plans && typeof productNode.plans === 'object') return productNode.plans;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries<any>(productNode)) {
    // Skip scalar siblings such as "ssl": 500.
    if (v && typeof v === 'object') out[k] = v;
  }
  return out;
}

/** Cost is nested under the product key again, and keyed by band id. */
function costBands(costs: any, productKey: string): Record<string, any> {
  const node = costs?.[productKey];
  if (!node || typeof node !== 'object') return {};
  const inner = node[productKey];
  return inner && typeof inner === 'object' ? inner : node;
}

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
    const notes: string[] = [];

    for (const [productType, keys] of Object.entries(PRODUCT_KEYS)) {
      // Take the first candidate that actually carries plans, not merely the
      // first that exists. `eeliteus` is present in the catalogue but empty,
      // and stopping there left business email unsellable while
      // `enterpriseemailus` sat behind it with real plans.
      let productKey: string | undefined;
      let plans: Record<string, any> = {};
      for (const candidate of keys) {
        if (!Object.prototype.hasOwnProperty.call(customerPrices, candidate)) continue;
        const found = planNodes(customerPrices[candidate]);
        if (Object.keys(found).length) {
          productKey = candidate;
          plans = found;
          break;
        }
      }
      if (!productKey) continue;

      const details = await getPlanDetails(productKey);
      const bands = costBands(costs, productKey);

      const forType: Record<string, PlanPricing> = {};

      for (const [planId, node] of Object.entries<any>(plans)) {
        const detail = details[planId];
        // With no name there is nothing to attach the price to, and matching
        // by position would put the top tier's price on the entry tier.
        if (!detail) continue;

        const add = node?.add ?? {};
        const renew = node?.renew ?? {};

        const tenures = Object.keys(add)
          .map((m) => Number(m))
          .filter((m) => Number.isFinite(m) && m > 0)
          .sort((a, b) => a - b);
        if (!tenures.length) continue;

        const monthly = num(add['1']);
        const annualMonthly = num(add['12']) ?? num(add[String(tenures[0])]);
        const renewMonthly = num(renew['12']) ?? num(renew[String(tenures[0])]);

        const band = detail.bandId ? bands[detail.bandId] : undefined;
        const costAdd = num(band?.pricing?.add);
        const costRenew = num(band?.pricing?.renew);

        if (!monthly && !annualMonthly) continue;

        forType[detail.name] = {
          planId,
          planName: detail.name,
          isLegacy: isLegacyPlanName(detail.name),
          bandId: detail.bandId,
          status: detail.status,
          minTenureMonths: tenures[0],
          webspaceMb: detail.webspaceMb,
          mailAccounts: detail.mailAccounts,
          monthlyUsd: monthly ? toUsd(monthly) : undefined,
          annualMonthlyUsd: annualMonthly ? toUsd(annualMonthly) : undefined,
          renewMonthlyUsd: renewMonthly ? toUsd(renewMonthly) : undefined,
          wholesaleMonthlyUsd: costAdd ? toUsd(costAdd) : undefined,
          wholesaleRenewMonthlyUsd: costRenew ? toUsd(costRenew) : undefined,
          source: 'live',
        };
      }

      if (Object.keys(forType).length) {
        result[productType] = forType;

        // Worth seeing in the logs: a plan we price but cannot sell.
        const paused = Object.values(forType)
          .filter((p) => p.status !== 'Active')
          .map((p) => `${p.planName}:${p.status}`);
        if (paused.length) notes.push(`${productType} not sellable: ${paused.join(', ')}`);
      }
    }

    console.log(
      `[HostingPricing] priced ${Object.keys(result).length} families` +
        (notes.length ? `; ${notes.join('; ')}` : '')
    );

    cache = result;
    cacheExpiry = now + CACHE_TTL_MS;
    return result;
  } catch (err: any) {
    console.warn('[HostingPricing] Could not fetch live plan pricing:', err?.message);
    return {};
  }
}

/**
 * The plan a purchase would actually be provisioned as, or null.
 *
 * Returns nothing for a plan upstream has paused, has no price for, or does
 * not list at all. Checkout uses this to refuse an order the provider could
 * not fulfil, rather than taking payment and failing afterwards.
 */
export async function getSellablePlan(
  productType: string,
  planName: string
): Promise<PlanPricing | null> {
  const all = await getLiveHostingPricing();
  const family = all[productType];
  if (!family) return null;

  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = Object.values(family).find((p) => norm(p.planName) === norm(planName));
  if (!hit) return null;
  // Same rule as /api/hosting/pricing: orderable unless upstream says it is
  // not. Most products report no status at all.
  const unsellable = ['paused', 'deleted', 'inactive', 'discontinued', 'suspended'];
  if (unsellable.includes(String(hit.status).toLowerCase())) return null;
  return hit;
}

/** Clears the in-process caches. Used by the regression tests only. */
export function __resetForTests(): void {
  cache = null;
  cacheExpiry = 0;
  planDetailCache.clear();
}
