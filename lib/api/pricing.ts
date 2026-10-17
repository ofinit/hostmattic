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
  /**
   * Renewal pricing, from the upstream `renewdomain` action. Registration and
   * renewal are frequently priced differently - promotional first-year rates in
   * particular - so renewals must never be quoted from the registration price.
   */
  renewInr: number;
  renewUsd: number;
  /**
   * Transfer-in pricing, from the upstream `addtransferdomain` action. A third
   * price again: the transfer page used to charge a flat $7.99 for every
   * extension, which was 11% margin on .co.in and a Rs2,342 loss on a .io.
   * Zero means upstream gave us no transfer price, and the UI must say so
   * rather than fall back to anything.
   */
  transferInr: number;
  transferUsd: number;
  /**
   * Redemption price, from the upstream `restoredomain` action. A lapsed
   * .co.in costs about Rs7,300 to restore against Rs850 to renew, and saying
   * so is the entire point of an expiry reminder.
   */
  restoreInr: number;
  wholesaleCostInr?: number;
  renewWholesaleCostInr?: number;
  transferWholesaleCostInr?: number;
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
  // Every third-level .in extension is one upstream product: `thirdleveldotin`,
  // shown in the reseller panel as ".IN 3rd Level Domain Names". The
  // per-extension keys previously used here (dotcoin, dotnetin, dotorgin) are
  // not in the catalogue, so those extensions resolved to no live price at all.
  // This list is the one upstream reports for the product.
  '.co.in': 'thirdleveldotin',
  '.net.in': 'thirdleveldotin',
  '.org.in': 'thirdleveldotin',
  '.gen.in': 'thirdleveldotin',
  '.firm.in': 'thirdleveldotin',
  '.ind.in': 'thirdleveldotin',
  '.com.in': 'thirdleveldotin',
  '.biz.in': 'thirdleveldotin',
  '.info.in': 'thirdleveldotin',
  '.me.in': 'thirdleveldotin',
  '.pro.in': 'thirdleveldotin',
  '.tv.in': 'thirdleveldotin',
  '.io.in': 'thirdleveldotin',
  '.ai.in': 'thirdleveldotin',
  '.business.in': 'thirdleveldotin',
  '.internet.in': 'thirdleveldotin',
  '.travel.in': 'thirdleveldotin',
  '.coop.in': 'thirdleveldotin',
  '.int.in': 'thirdleveldotin',
  '.post.in': 'thirdleveldotin',
  '.us.in': 'thirdleveldotin',
  '.uk.in': 'thirdleveldotin',
  '.cn.in': 'thirdleveldotin',
  '.delhi.in': 'thirdleveldotin',
  '.bihar.in': 'thirdleveldotin',
  '.gujarat.in': 'thirdleveldotin',
  '.up.in': 'thirdleveldotin',
  '.am.in': 'thirdleveldotin',
  '.cs.in': 'thirdleveldotin',
  '.dr.in': 'thirdleveldotin',
  '.er.in': 'thirdleveldotin',
  '.pg.in': 'thirdleveldotin',
  '.5g.in': 'thirdleveldotin',
  '.6g.in': 'thirdleveldotin',
};

// Default fallback prices if live gateway is unreachable
const STATIC_FALLBACK_PRICING: Record<string, TldPricingInfo> = {
  '.com': { tld: '.com', productKey: 'domcno', retailInr: 1085, retailUsd: 12.99, renewInr: 1085, renewUsd: 12.99, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 999, isPromo: false, badge: 'Most Popular', popular: true },
  '.in': { tld: '.in', productKey: 'dotin', retailInr: 779, retailUsd: 8.99, renewInr: 779, renewUsd: 8.99, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 699, isPromo: false, badge: 'Best in India', popular: true },
  '.net': { tld: '.net', productKey: 'dotnet', retailInr: 1250, retailUsd: 14.49, renewInr: 1250, renewUsd: 14.49, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 1144, isPromo: false, badge: 'Tech Classic' },
  '.org': { tld: '.org', productKey: 'domorg', retailInr: 1110, retailUsd: 13.29, renewInr: 1110, renewUsd: 13.29, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 959, isPromo: true, badge: 'Special Offer' },
  '.tech': { tld: '.tech', productKey: 'dottech', retailInr: 1022, retailUsd: 12.24, renewInr: 1022, renewUsd: 12.24, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 879, isPromo: true, badge: '72% OFF', popular: true },
  '.online': { tld: '.online', productKey: 'dotonline', retailInr: 736, retailUsd: 8.81, renewInr: 736, renewUsd: 8.81, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 619, isPromo: true, badge: '74% OFF' },
  '.store': { tld: '.store', productKey: 'dotstore', retailInr: 879, retailUsd: 10.53, renewInr: 879, renewUsd: 10.53, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 749, isPromo: true, badge: '80% OFF' },
  '.io': { tld: '.io', productKey: 'dotio', retailInr: 3365, retailUsd: 40.30, renewInr: 3365, renewUsd: 40.30, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 3009, isPromo: true, badge: '24% OFF' },
  '.co': { tld: '.co', productKey: 'dotco', retailInr: 1935, retailUsd: 23.17, renewInr: 1935, renewUsd: 23.17, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 1749, isPromo: true, badge: '16% OFF' },
  '.ai': { tld: '.ai', productKey: 'dotai', retailInr: 6679, retailUsd: 79.99, renewInr: 6679, renewUsd: 79.99, transferInr: 0, transferUsd: 0, restoreInr: 0, wholesaleCostInr: 5999, isPromo: false },
};

// In-memory cache with 1-hour TTL
let pricingCache: Record<string, TldPricingInfo> | null = null;
let cacheExpiry: number = 0;
// Five minutes, not an hour. Prices are changed deliberately in the reseller
// panel and the person doing it expects to see the result, not to wait out a
// cache. Three upstream calls every five minutes per container is negligible
// against being an hour out of date.
//
// Admin -> Refresh pricing clears this immediately when the wait still matters.
const CACHE_TTL_MS = 5 * 60 * 1000;
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
      let renewWholesaleCost: number | undefined = undefined;
      let transferWholesaleCost: number | undefined = undefined;
      if (costs && typeof costs === 'object') {
        const costItem = costs[productKey];
        const addCost = costItem?.addnewdomain?.['1'] || costItem?.['0']?.pricing?.addnewdomain?.['1'];
        if (addCost) {
          wholesaleCost = Number(addCost);
        }
        const rnwCost = costItem?.renewdomain?.['1'] || costItem?.['0']?.pricing?.renewdomain?.['1'];
        if (rnwCost) {
          renewWholesaleCost = Number(rnwCost);
        }
        const trfCost =
          costItem?.addtransferdomain?.['1'] ||
          costItem?.['0']?.pricing?.addtransferdomain?.['1'] ||
          costItem?.transferdomain?.['1'] ||
          costItem?.['0']?.pricing?.transferdomain?.['1'];
        if (trfCost) {
          transferWholesaleCost = Number(trfCost);
        }
      }

      // Find WebPro panel custom customer selling price
      let webProSellingPrice: number | undefined = undefined;
      let webProRenewPrice: number | undefined = undefined;
      let webProTransferPrice: number | undefined = undefined;
      let webProRestorePrice: number | undefined = undefined;
      if (customerPrices && typeof customerPrices === 'object') {
        const custItem = customerPrices[productKey];
        const custPrice = custItem?.addnewdomain?.['1'] || custItem?.['0']?.pricing?.addnewdomain?.['1'];
        if (custPrice) {
          webProSellingPrice = Number(custPrice);
        }
        const custRenew = custItem?.renewdomain?.['1'] || custItem?.['0']?.pricing?.renewdomain?.['1'];
        if (custRenew) {
          webProRenewPrice = Number(custRenew);
        }
        const custTransfer =
          custItem?.addtransferdomain?.['1'] ||
          custItem?.['0']?.pricing?.addtransferdomain?.['1'] ||
          custItem?.transferdomain?.['1'] ||
          custItem?.['0']?.pricing?.transferdomain?.['1'];
        if (custTransfer) {
          webProTransferPrice = Number(custTransfer);
        }
        const custRestore =
          custItem?.restoredomain?.['1'] || custItem?.['0']?.pricing?.restoredomain?.['1'];
        if (custRestore) {
          webProRestorePrice = Number(custRestore);
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

        // A promotion discounts OUR cost as well as the customer's price.
        // Keeping the standard cost here reported a Rs142 .shop sale against a
        // Rs3,199 cost - a fiction, and a large one, across every promotional
        // extension. The field name is not documented consistently, so read
        // the plausible spellings and fall back to the standard cost only when
        // none is present.
        const promoCost =
          promo.resellercost ??
          promo.resellerprice ??
          promo.resellercostprice ??
          promo.costprice ??
          promo.partnercost;
        const promoCostNum = Number(promoCost);
        if (Number.isFinite(promoCostNum) && promoCostNum > 0) {
          wholesaleCost = promoCostNum;
        } else if (wholesaleCost && retailInr < wholesaleCost) {
          // No promotional cost was published, yet the promotional price is
          // below the standard cost. Reporting that as a loss would be wrong,
          // and so would inventing a number, so the cost is marked unknown.
          console.warn(
            `[Pricing] ${tld}: promotional price Rs${retailInr} is below the standard cost ` +
              `Rs${wholesaleCost} and the promotion publishes no reseller cost. ` +
              'Margin for this extension cannot be computed.'
          );
          wholesaleCost = undefined;
        }
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

      // Renewal retail. A promotional registration rate must never leak into
      // the renewal quote, so this is derived only from renewal inputs, and
      // falls back to the per-TLD static figure rather than a flat default.
      const renewInr = Math.round(
        webProRenewPrice
          ? webProRenewPrice
          : renewWholesaleCost
          ? renewWholesaleCost + Math.max(80, renewWholesaleCost * 0.10)
          : STATIC_FALLBACK_PRICING[tld]?.renewInr || baseStandardInr
      );

      // Curated standard badges if no promo
      if (!badge) {
        if (tld === '.com') badge = 'Most Popular';
        else if (tld === '.in') badge = 'Best in India';
        else if (tld === '.net') badge = 'Tech Classic';
        else if (tld === '.org') badge = 'Authority';
      }

      // Transfer, like renewal, is derived only from transfer inputs. There is
      // deliberately NO flat fallback: if upstream prices no transfer for this
      // extension we publish zero, and the UI refuses the sale rather than
      // guessing. A flat $7.99 here was an 11% margin on .co.in and a loss of
      // over Rs2,000 on a .io.
      const transferInr = Math.round(
        webProTransferPrice
          ? webProTransferPrice
          : transferWholesaleCost
          ? transferWholesaleCost + Math.max(80, transferWholesaleCost * 0.1)
          : 0
      );

      const retailUsd = Number((retailInr / USD_INR_RATE).toFixed(2));
      const renewUsd = Number((renewInr / USD_INR_RATE).toFixed(2));
      const transferUsd = transferInr
        ? Number((transferInr / USD_INR_RATE).toFixed(2))
        : 0;

      computed[tld] = {
        tld,
        productKey,
        retailInr,
        retailUsd,
        renewInr,
        renewUsd,
        transferInr,
        transferUsd,
        // No fallback: an unknown restore price is simply not quoted.
        restoreInr: webProRestorePrice ? Math.round(webProRestorePrice) : 0,
        wholesaleCostInr: wholesaleCost,
        renewWholesaleCostInr: renewWholesaleCost,
        transferWholesaleCostInr: transferWholesaleCost,
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


/**
 * Drops the cached domain prices so the next request reads upstream again.
 * Used by the admin refresh action after a price change in the panel.
 */
export function clearDomainPricingCache(): void {
  pricingCache = null;
  cacheExpiry = 0;
}
