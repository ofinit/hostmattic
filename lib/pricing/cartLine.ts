/**
 * The fields the server prices a basket line by.
 *
 * Built in one place because two callers need the identical answer: the check
 * the checkout drawer runs when it opens, and the payload it posts when the
 * customer pays. If those disagreed the drawer would show a total the server
 * then refuses - which is the fault the open-time check exists to remove.
 *
 * Kept free of React and of path aliases so the test harness can compile it.
 */

/** Only the parts of a cart line that bear on price. */
export interface PricedCartLine {
  type?: string;
  productType?: string;
  name?: string;
  domainName?: string;
  upstreamPlan?: string;
  billingPeriod?: 'monthly' | 'annual' | string;
  priceMonthly?: number;
  priceAnnual?: number;
  /**
   * The catalogue's exact rupee price, where the line has one. Prices are held
   * upstream in rupees; converting to dollars and back loses precision, and
   * that loss has reached a tax invoice.
   */
  priceAnnualInr?: number;
  years?: number;
}

/** Two decimal places, away from binary floating point's long tail. */
export function toMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The unit price for a line, in the order's currency.
 *
 * `rate` converts the dollar figures; pass 1 for a USD order.
 */
export function unitPriceFor(
  item: PricedCartLine,
  currency: string,
  rate: number
): number {
  const annual = item.billingPeriod === 'annual';

  // Prefer the catalogue's own rupee figure. Converting dollars back to rupees
  // turned Rs750 into Rs749.83, and Rs1,880 into Rs1,879.59.
  if (currency === 'INR' && typeof item.priceAnnualInr === 'number' && item.priceAnnualInr > 0) {
    return annual ? item.priceAnnualInr : toMoney(item.priceAnnualInr / 12);
  }

  const base = (annual ? item.priceAnnual : item.priceMonthly) || 0;
  // Rounded: 22.51 * 83.5 is 1879.5885000000001, and that figure was reaching
  // the server, the gateway and the invoice.
  return toMoney(base * rate);
}

/**
 * The annual rupee price implied by an authoritative unit price the server
 * returned, so a corrected line stops round-tripping through dollars.
 *
 * Returns undefined for a non-rupee order, where there is no rupee figure to
 * keep.
 */
export function annualInrFrom(
  expected: number,
  billingPeriod: string | undefined,
  currency: string
): number | undefined {
  if (currency !== 'INR' || !(expected > 0)) return undefined;
  return billingPeriod === 'annual' ? expected : toMoney(expected * 12);
}

/** The line as the pricing endpoint and checkout both expect it. */
export function pricingLineFor(item: PricedCartLine, currency: string, rate: number) {
  return {
    type: item.type,
    productType: item.productType || 'SERVICE',
    name: item.name,
    domainName: item.domainName || (item.type === 'DOMAIN' ? item.name : undefined),
    upstreamPlan: item.upstreamPlan,
    years: item.years,
    price: unitPriceFor(item, currency, rate),
    period: item.billingPeriod === 'annual' ? '1 Year' : '1 Month',
  };
}
