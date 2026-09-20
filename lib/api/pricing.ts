/**
 * Hostmattic Dynamic Pricing & Promo Engine
 * Connects directly to upstream ResellerClub / OrderBox wholesale and promo endpoints.
 * Automatically synchronizes real-time promo discounts, wholesale margins, and customer pricing with high-speed memory caching.
 */

import { apiClient, isLiveApiConfigured } from './client';

export interface TldPricingInfo {
  tld: string;
  productKey: string;
  retailInr: number;
  retailUsd: number;
  wholesaleCostInr?: number;
  isPromo: boolean;
  promoEndsAt?: string;
  badge?: string;
  popular?: boolean;
}

// Map TLD extensions to upstream product keys
export const TLD_TO_PRODUCT_KEY: Record<string, string> = {
  '.com': 'domcno',
  '.net': 'dotnet',
  '.in': 'dotin',
  '.org': 'domorg',
  '.tech': 'dottech',
  '.technology': 'dottechnology',
  '.online': 'dotonline',
  '.store': 'dotstore',
  '.io': 'dotio',
  '.co': 'dotco',
  '.ai': 'dotai',
  '.biz': 'dotbiz',
  '.info': 'dominfo',
  '.dev': 'dotdev',
  '.app': 'dotapp',
  '.shop': 'dotshop',
  '.cloud': 'dotcloud',
  '.live': 'dotlive',
  '.top': 'dottop',
  '.site': 'dotsite',
  '.xyz': 'dotxyz',
  '.me': 'dotme',
  '.club': 'dotclub',
  '.pro': 'dotpro',
  '.website': 'dotwebsite',
  '.vip': 'dotvip',
  '.co.in': 'dotcoin',
  '.net.in': 'dotnetin',
  '.org.in': 'dotorgin',
};

// Default fallback prices if live gateway is unreachable
const STATIC_FALLBACK_PRICING: Record<string, TldPricingInfo> = {
  '.com': { tld: '.com', productKey: 'domcno', retailInr: 1085, retailUsd: 12.99, wholesaleCostInr: 999, isPromo: false, badge: 'Most Popular', popular: true },
  '.in': { tld: '.in', productKey: 'dotin', retailInr: 779, retailUsd: 8.99, wholesaleCostInr: 699, isPromo: false, badge: 'Best in India', popular: true },
  '.net': { tld: '.net', productKey: 'dotnet', retailInr: 1250, retailUsd: 14.49, wholesaleCostInr: 1144, isPromo: false, badge: 'Tech Classic' },
  '.org': { tld: '.org', productKey: 'domorg', retailInr: 1110, retailUsd: 13.29, wholesaleCostInr: 959, isPromo: true, badge: 'Special Offer' },
  '.tech': { tld: '.tech', productKey: 'dottech', retailInr: 1022, retailUsd: 12.24, wholesaleCostInr: 879, isPromo: true, badge: '72% OFF', popular: true },
  '.online': { tld: '.online', productKey: 'dotonline', retailInr: 736, retailUsd: 8.81, wholesaleCostInr: 619, isPromo: true, badge: '74% OFF' },
  '.store': { tld: '.store', productKey: 'dotstore', retailInr: 879, retailUsd: 10.53, wholesaleCostInr: 749, isPromo: true, badge: '80% OFF' },
  '.io': { tld: '.io', productKey: 'dotio', retailInr: 3365, retailUsd: 40.30, wholesaleCostInr: 3009, isPromo: true, badge: '24% OFF' },
  '.co': { tld: '.co', productKey: 'dotco', retailInr: 1935, retailUsd: 23.17, wholesaleCostInr: 1749, isPromo: true, badge: '16% OFF' },
  '.ai': { tld: '.ai', productKey: 'dotai', retailInr: 6679, retailUsd: 79.99, wholesaleCostInr: 5999, isPromo: false },
};

// In-memory cache with 1-hour TTL
let pricingCache: Record<string, TldPricingInfo> | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const USD_INR_RATE = 83.5;

/**
 * Fetch and calculate all live TLD prices with upstream promotions
 */
export async function getLiveDomainPricing(): Promise<Record<string, TldPricingInfo>> {
  const now = Date.now();
  if (pricingCache && now < cacheExpiry) {
    return pricingCache;
  }

  if (!isLiveApiConfigured()) {
    pricingCache = STATIC_FALLBACK_PRICING;
    cacheExpiry = now + CACHE_TTL_MS;
    return pricingCache;
  }

  try {
    // Parallel fetch: promo details + actual wholesale cost + custom customer selling prices set in WebPro panel
    const [promoRes, costRes, customerPriceRes] = await Promise.all([
      apiClient<Record<string, any>>('/resellers/promo-details.json', {}, 'GET'),
      apiClient<Record<string, any>>('/products/reseller-cost-price.json', {}, 'GET'),
      apiClient<Record<string, any>>('/products/customer-price.json', {}, 'GET'),
    ]);

    const promos = promoRes.success && promoRes.data ? promoRes.data : {};
    const costs = costRes.success && costRes.data ? costRes.data : {};
    const customerPrices = customerPriceRes.success && customerPriceRes.data ? customerPriceRes.data : {};

    const computed: Record<string, TldPricingInfo> = {};

    for (const [tld, productKey] of Object.entries(TLD_TO_PRODUCT_KEY)) {
      // Find active promo for this product
      let promo: any = null;
      if (promos && typeof promos === 'object') {
        promo = Object.values(promos).find(
          (p: any) =>
            p &&
            typeof p === 'object' &&
            p.productkey === productKey &&
            p.isactive === 'true' &&
            p.actiontype === 'addnewdomain'
        );
      }

      // Find exact wholesale cost from reseller-cost-price
      let wholesaleCost: number | undefined = undefined;
      if (costs && typeof costs === 'object') {
        const costItem = costs[productKey];
        const addCost = costItem?.addnewdomain?.['1'] || costItem?.['0']?.pricing?.addnewdomain?.['1'];
        if (addCost) {
          wholesaleCost = Number(addCost);
        }
      }

      // Find WebPro panel custom customer selling price
      let webProSellingPrice: number | undefined = undefined;
      if (customerPrices && typeof customerPrices === 'object') {
        const custItem = customerPrices[productKey];
        const custPrice = custItem?.addnewdomain?.['1'] || custItem?.['0']?.pricing?.addnewdomain?.['1'];
        if (custPrice) {
          webProSellingPrice = Number(custPrice);
        }
      }

      let retailInr = 0;
      let isPromo = false;
      let badge: string | undefined = undefined;
      let promoEndsAt: string | undefined = undefined;

      // Base standard retail: prioritize WebPro panel configured selling price, fallback to wholesale + margin
      const baseStandardInr = webProSellingPrice
        ? webProSellingPrice
        : wholesaleCost
        ? Math.round(wholesaleCost + Math.max(80, wholesaleCost * 0.10))
        : (STATIC_FALLBACK_PRICING[tld]?.retailInr || 1085);

      if (promo && promo.customerprice) {
        isPromo = true;
        retailInr = Math.round(Number(promo.customerprice));
        if (promo.endtime) {
          promoEndsAt = new Date(Number(promo.endtime) * 1000).toISOString();
        }

        // Calculate discount percentage relative to standard cost
        const standardCostRef = baseStandardInr;
        if (standardCostRef > retailInr) {
          const discount = Math.round(((standardCostRef - retailInr) / standardCostRef) * 100);
          badge = discount >= 15 ? `${discount}% OFF` : 'SPECIAL OFFER';
        } else {
          badge = 'HOT PROMO';
        }
      } else {
        retailInr = baseStandardInr;
      }

      // Curated standard badges if no promo
      if (!badge) {
        if (tld === '.com') badge = 'Most Popular';
        else if (tld === '.in') badge = 'Best in India';
        else if (tld === '.net') badge = 'Tech Classic';
        else if (tld === '.org') badge = 'Authority';
      }

      const retailUsd = Number((retailInr / USD_INR_RATE).toFixed(2));

      computed[tld] = {
        tld,
        productKey,
        retailInr,
        retailUsd,
        wholesaleCostInr: wholesaleCost,
        isPromo,
        promoEndsAt,
        badge,
        popular: tld === '.com' || tld === '.in' || tld === '.tech',
      };
    }

    pricingCache = { ...STATIC_FALLBACK_PRICING, ...computed };
    cacheExpiry = now + CACHE_TTL_MS;
    return pricingCache;
  } catch (error) {
    console.error('Failed to fetch live upstream pricing:', error);
    pricingCache = STATIC_FALLBACK_PRICING;
    cacheExpiry = now + 5 * 60 * 1000; // Retry in 5 minutes on error
    return pricingCache;
  }
}

/**
 * Get pricing for a single TLD
 */
export async function getPricingForTld(tld: string): Promise<TldPricingInfo> {
  const normalized = tld.startsWith('.') ? tld.toLowerCase() : `.${tld.toLowerCase()}`;
  const allPrices = await getLiveDomainPricing();
  return allPrices[normalized] || {
    tld: normalized,
    productKey: 'generic',
    retailInr: 1085,
    retailUsd: 12.99,
    isPromo: false,
  };
}
