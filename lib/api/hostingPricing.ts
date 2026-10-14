/**
 * Live hosting / server / email / security plan pricing.
 *
 * Domain pricing (lib/api/pricing.ts) has been live for a while; every other
 * product family still carried prices hardcoded into its page, so a cost change
 * upstream was invisible until someone noticed the margin.
 *
 * Unlike domains, the upstream response shape for plan-based products is not
 * documented in a form we could verify here, and the panel exposes different
 * product keys per reseller. This module therefore:
 *
 *   - tries several plausible key spellings per product family
 *   - parses several plausible payload shapes
 *   - LOGS what it actually received when a family cannot be matched
 *   - returns nothing rather than guessing, so each page keeps its own
 *     published price until a real one is found
 *
 * The log line is the point: run this once in production and the real keys and
 * shape appear in the Coolify logs, after which the mapping can be made exact.
 */

import { apiClient, isLiveApiConfigured } from './client';

const USD_INR_RATE = 83.5;
const CACHE_TTL_MS = 15 * 60 * 1000;

export interface PlanPricing {
  /** Price for one month, billed monthly. */
  monthlyUsd?: number;
  /** Effective per-month price when billed annually. */
  annualMonthlyUsd?: number;
  /** Full annual charge. */
  annualUsd?: number;
  /** What we pay upstream, for margin reporting. */
  wholesaleAnnualUsd?: number;
  source: 'live' | 'none';
}

/** productType -> planName -> pricing */
export type HostingPricingMap = Record<string, Record<string, PlanPricing>>;

/**
 * Candidate upstream product keys per productType, most likely first.
 * Resellers get different keys depending on which products they signed up for,
 * so this is a search list rather than a single value.
 */
export const PRODUCT_KEY_CANDIDATES: Record<string, string[]> = {
  SHARED_LINUX: ['singledomainlinuxus', 'singledomainhosting', 'lhus', 'linuxsharedhosting', 'shus'],
  SHARED_WINDOWS: ['singledomainwindowsus', 'whus', 'windowssharedhosting', 'swus'],
  MULTI_DOMAIN: ['multidomainlinuxus', 'multidomainhosting', 'mdlhus'],
  WORDPRESS: ['wordpresshosting', 'managedwordpress', 'wphosting', 'wpus'],
  CLOUD: ['cloudhosting', 'cloudsitesus', 'chus'],
  RESELLER: ['resellerlinuxus', 'resellerhosting', 'rhus', 'resellerwindowsus'],
  VPS: ['vpslinuxus', 'kvmvpslinuxus', 'vps', 'vpsus'],
  DEDICATED: ['dedicatedserverlinuxus', 'dedicatedserver', 'dsus'],
  EMAIL_BUSINESS: ['eeliteus', 'businessemailus', 'enterpriseemail', 'businessemail'],
  EMAIL_GOOGLE: ['gsuite', 'googleworkspace', 'gapps'],
  SECURITY_SITELOCK: ['sitelock', 'sitelockbasic'],
  SECURITY_CODEGUARD: ['codeguard', 'codeguardbasic'],
  SECURITY_ACRONIS: ['acronisbackup', 'acronis'],
  TOOLS_BUILDER: ['sitebuilder', 'websitebuilder', 'weebly'],
  COMBO_PLANS: ['comboplan', 'combo'],
};

let cache: HostingPricingMap | null = null;
let cacheExpiry = 0;

/** Pull a number out of whichever nesting the payload happens to use. */
function readPrice(node: any, action: string, months: string): number | undefined {
  if (!node || typeof node !== 'object') return undefined;

  const candidates = [
    node?.[action]?.[months],
    node?.pricing?.[action]?.[months],
    node?.['0']?.pricing?.[action]?.[months],
    node?.plan?.[action]?.[months],
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/**
 * A plan-based product nests plan names under the product key. Return those
 * child objects, skipping scalar metadata fields.
 */
function planNodes(productNode: any): Record<string, any> {
  if (!productNode || typeof productNode !== 'object') return {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(productNode)) {
    if (v && typeof v === 'object') out[k] = v;
  }
  return out;
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

    const available = Object.keys(customerPrices);
    const result: HostingPricingMap = {};
    const unmatched: string[] = [];

    for (const [productType, keys] of Object.entries(PRODUCT_KEY_CANDIDATES)) {
      const key = keys.find((k) => Object.prototype.hasOwnProperty.call(customerPrices, k));
      if (!key) {
        unmatched.push(productType);
        continue;
      }

      const plans = planNodes(customerPrices[key]);
      const costPlans = planNodes(costs[key] || {});
      const forType: Record<string, PlanPricing> = {};

      for (const [planName, node] of Object.entries(plans)) {
        const monthly = readPrice(node, 'add', '1') ?? readPrice(node, 'addnewdomain', '1');
        const annual = readPrice(node, 'add', '12') ?? readPrice(node, 'addnewdomain', '12');
        const costAnnual =
          readPrice(costPlans[planName], 'add', '12') ?? readPrice(costPlans[planName], 'addnewdomain', '12');

        if (!monthly && !annual) continue;

        forType[planName] = {
          monthlyUsd: monthly ? Number((monthly / USD_INR_RATE).toFixed(2)) : undefined,
          annualUsd: annual ? Number((annual / USD_INR_RATE).toFixed(2)) : undefined,
          annualMonthlyUsd: annual ? Number((annual / 12 / USD_INR_RATE).toFixed(2)) : undefined,
          wholesaleAnnualUsd: costAnnual ? Number((costAnnual / USD_INR_RATE).toFixed(2)) : undefined,
          source: 'live',
        };
      }

      if (Object.keys(forType).length) result[productType] = forType;
      else unmatched.push(productType);
    }

    // This is how the real keys and shape get discovered. Without live access we
    // cannot confirm either, so say plainly what was and was not matched.
    console.log(
      `[HostingPricing] matched ${Object.keys(result).length} product families` +
        (unmatched.length ? `; no pricing for: ${unmatched.join(', ')}` : '') +
        `; upstream keys available: ${available.slice(0, 40).join(', ')}${available.length > 40 ? ' …' : ''}`
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
 * Overlay live pricing onto a page's published plans.
 * A plan with no live match keeps its own figures, so nothing is ever shown at
 * a price we invented.
 */
export function applyLivePricing<T extends { name: string; usdMonthly: number; usdAnnualMonthly: number }>(
  plans: T[],
  productType: string,
  live: HostingPricingMap
): T[] {
  const forType = live?.[productType];
  if (!forType) return plans;

  return plans.map((plan) => {
    // Match on plan name, case/space-insensitively.
    const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, '');
    const hit = Object.entries(forType).find(([k]) => norm(k) === norm(plan.name));
    if (!hit) return plan;

    const p = hit[1];
    return {
      ...plan,
      usdMonthly: p.monthlyUsd ?? plan.usdMonthly,
      usdAnnualMonthly: p.annualMonthlyUsd ?? plan.usdAnnualMonthly,
    };
  });
}
