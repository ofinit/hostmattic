/**
 * Hostmattic Financial Analytics & Profit & Loss (P&L) Engine
 *
 * Computes:
 * 1. Line-item wholesale cost of goods sold (COGS) based on upstream catalog.
 * 2. Gross profit and net profit margins across currencies (INR and USD).
 * 3. Statutory GST tax liabilities (CGST + SGST vs IGST vs 0% LUT export).
 * 4. Expiration lifecycle tracking and 30-day renewal alert buckets.
 */

import { usdInrRate } from '../pricing/fx';

/**
 * Kept as a named export because callers import it, but it is no longer a
 * constant: the rate lives in lib/pricing/fx.ts so there is one of it.
 */
export const USD_TO_INR_RATE = usdInrRate();

// The per-TLD wholesale table that used to live here has been removed.
//
// It was a hardcoded ten-entry guess: .in at Rs699 against an actual Rs689,
// no .co.in at all (so every .co.in resolved to .in by substring match and
// was costed too cheaply), and one figure for registration, renewal and
// transfer, which upstream prices separately. Real costs now come from
// getLiveDomainPricing() and are passed in as a DomainCostTable; anything
// that cannot be priced from upstream is flagged `costEstimated` instead of
// quietly substituting a stale number.

// Baseline product gross margin ratios (Retail - Margin = Wholesale Cost)
const PRODUCT_MARGIN_RATIOS: Record<string, number> = {
  DOMAIN: 0.20,         // ~20% retail margin
  SHARED_LINUX: 0.50,   // ~50% gross margin
  SHARED_WINDOWS: 0.48, // ~48% gross margin
  WORDPRESS: 0.52,      // ~52% gross margin
  CLOUD: 0.45,          // ~45% gross margin
  RESELLER: 0.40,       // ~40% gross margin
  VPS: 0.38,            // ~38% gross margin
  DEDICATED: 0.28,      // ~28% gross margin
  EMAIL: 0.45,          // ~45% gross margin
  SECURITY: 0.55,       // ~55% gross margin
};

export interface OrderItemFinancials {
  id: string;
  productType: string;
  description: string;
  /**
   * True when the cost was derived from a margin ratio because upstream had
   * no figure for this TLD and action. The console must label it rather than
   * presenting a guess as a measured cost.
   */
  costEstimated?: boolean;
  retailPrice: number;
  wholesaleCost: number;
  /**
   * GST the upstream supplier charges us on that cost (18%). For a registered
   * business this is input tax credit, not an expense - it offsets the GST we
   * collect - so it is tracked separately and kept out of margin.
   */
  inputGst: number;
  grossProfit: number;
  marginPercent: number;
  currency: string;
}

export interface OrderFinancialSummary {
  orderId: string;
  orderNumber: string;
  currency: string;
  grossAmount: number;     // Customer payment with tax
  taxAmount: number;       // GST collected
  netSales: number;        // Turnover excluding tax
  totalCost: number;       // Wholesale COGS, exclusive of input GST
  /** True when ANY line's cost was estimated rather than read from upstream. */
  costEstimated?: boolean;
  grossProfit: number;     // Net Sales - Total Cost
  marginPercent: number;
  /** GST charged to us by the supplier on this order's cost. */
  inputGstPaid: number;
  /** What actually leaves the bank: cost plus that GST. */
  cashCost: number;
  /**
   * GST collected from the customer less input credit on the same order.
   * Negative means the credit exceeds the liability.
   */
  netGstPosition: number;
  /**
   * True when output GST is zero but input GST was paid - an LUT export. The
   * credit cannot be offset against this sale and accumulates until it is
   * refunded, so until that refund is claimed the input GST is a real cost.
   */
  itcAccumulating: boolean;
  items: OrderItemFinancials[];
}

export interface FinancialAnalyticsReport {
  period: string;
  orderCount: number;
  paidOrderCount: number;

  // Dual Currency Totals
  inr: {
    turnover: number;      // Total billed
    netSales: number;      // Subtotal ex-tax
    taxCollected: number;
    cgst: number;
    sgst: number;
    igst: number;
    inputGst: number;
    netGstPayable: number;
    cogs: number;          // Wholesale cost
    grossProfit: number;
    marginPercent: number;
    aov: number;           // Average order value
  };

  usd: {
    turnover: number;
    netSales: number;
    taxCollected: number;
    lutExportSales: number;
    cogs: number;
    inputGst: number;
    blockedItcOnExports: number;
    grossProfit: number;
    marginPercent: number;
    aov: number;
  };

  // Consolidated Equivalent in INR
  consolidatedInr: {
    turnover: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    marginPercent: number;
  };

  // Distribution by Product Category
  productBreakdown: {
    category: string;
    label: string;
    salesCount: number;
    revenueInr: number;
    profitInr: number;
    sharePercent: number;
  }[];
}

export interface ServiceExpiryInfo {
  id: string;
  name: string;
  serviceType: 'DOMAIN' | 'HOSTING';
  planOrTld: string;
  customerName: string;
  customerEmail: string;
  expiryDate: string;
  daysRemaining: number;
  status: string;
  urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'NORMAL';
  autoRenew: boolean;
}

export interface ExpirationBuckets {
  expired: number;  // past expiry
  critical: number; // 0 to 7 days
  warning: number;  // 8 to 30 days
  normal: number;   // > 30 days
  total: number;
}

export interface ExpirationAnalyticsSummary {
  totalServices: number;
  expiredCount: number;
  criticalCount: number; // 0 to 7 days
  warningCount: number;  // 8 to 30 days
  normalCount: number;   // > 30 days
  totalRequiringAttention: number; // expired + <= 30 days
  expiringItems: ServiceExpiryInfo[];
  // Per-service-type breakdowns. The admin lifecycle filter chips read these;
  // without them every chip silently rendered 0 via `?? 0` even when rows existed.
  domains: ExpirationBuckets;
  hosting: ExpirationBuckets;
}

/**
 * What a domain line actually costs us depends on which action was sold.
 *
 * Upstream prices `addnewdomain`, `renewdomain`, `addtransferdomain` and
 * `restoredomain` separately, and the gaps are large - a .co.in costs about
 * Rs7,300 to restore against Rs850 to renew. Reading one figure for all four
 * is how a restore gets booked at a renewal's cost.
 */
export type DomainAction = 'register' | 'renew' | 'transfer' | 'restore';

/**
 * The per-TLD cost figures this module needs, structurally compatible with
 * `TldPricingInfo` from lib/api/pricing.ts.
 *
 * Declared here rather than imported so the analytics stay free of the API
 * client: the caller fetches the table and passes it in.
 */
export interface TldCostEntry {
  wholesaleCostInr?: number;
  renewWholesaleCostInr?: number;
  transferWholesaleCostInr?: number;
}
export type DomainCostTable = Record<string, TldCostEntry>;

/** Pulls the TLD off the first hostname in a line description. */
function tldFromDescription(description: string): string | undefined {
  const m = /([a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)+)/i.exec(description || '');
  if (!m) return undefined;
  const host = m[1].toLowerCase().replace(/\.$/, '');
  const dot = host.indexOf('.');
  return dot === -1 ? undefined : host.slice(dot);
}

/**
 * Resolves a TLD against the table, longest suffix first.
 *
 * `.co.in` must not resolve to `.in`. The old code tested
 * `description.includes(tld)` over an unordered object, so every .co.in was
 * costed as a .in - cheaper than the truth, which flattered the margin.
 */
function lookupTldEntry(tld: string | undefined, table: DomainCostTable): TldCostEntry | undefined {
  if (!tld) return undefined;
  let candidate = tld;
  while (candidate.includes('.')) {
    const hit = table[candidate];
    if (hit) return hit;
    const next = candidate.indexOf('.', 1);
    if (next === -1) break;
    candidate = candidate.slice(next);
  }
  return undefined;
}

/** Which domain action a line describes. */
export function domainActionOf(description: string): DomainAction {
  const d = (description || '').toLowerCase();
  if (/\btransfer/.test(d)) return 'transfer';
  if (/\brenew/.test(d)) return 'renew';
  if (/\brestor|\bredeem/.test(d)) return 'restore';
  return 'register';
}

function costForAction(entry: TldCostEntry, action: DomainAction): number | undefined {
  switch (action) {
    case 'renew':
      return entry.renewWholesaleCostInr ?? entry.wholesaleCostInr;
    case 'transfer':
      return entry.transferWholesaleCostInr ?? entry.renewWholesaleCostInr ?? entry.wholesaleCostInr;
    case 'restore':
      // Deliberately no fallback. A restore costs several times a renewal, so
      // substituting one would not be an approximation, it would be wrong by
      // a multiple. Returning undefined marks the line as estimated instead.
      return undefined;
    case 'register':
    default:
      return entry.wholesaleCostInr;
  }
}

export interface WholesaleCostResult {
  /** Cost in the ORDER's currency, for the whole line including its term. */
  cost: number;
  /**
   * False when the figure came from upstream, true when it was derived from a
   * margin ratio. An estimate is a guess and the console should say so rather
   * than presenting it as a measured cost.
   */
  estimated: boolean;
}

/**
 * Wholesale cost for one order line.
 *
 * Pass `costTable` (from getLiveDomainPricing) to use the real upstream cost.
 * Without it this falls back to a margin ratio and flags the result as an
 * estimate - it no longer silently returns a stale hardcoded figure.
 */
export function estimateItemWholesaleCostDetailed(
  productType: string,
  description: string,
  price: number,
  currency: string,
  costTable?: DomainCostTable,
  years?: number
): WholesaleCostResult {
  const typeKey = (productType || '').toUpperCase();
  const isDomain = typeKey === 'DOMAIN' || (description || '').toLowerCase().includes('domain');

  if (isDomain && costTable) {
    const entry = lookupTldEntry(tldFromDescription(description), costTable);
    if (entry) {
      const perYearInr = costForAction(entry, domainActionOf(description));
      if (perYearInr !== undefined && perYearInr > 0) {
        // Upstream quotes the rate for ONE unit of term, so a multi-year
        // registration costs a multiple of it. The previous code ignored the
        // term entirely and booked a 2-year order at a single year's cost,
        // overstating profit on every one of them.
        const term = years && years > 0 ? years : 1;
        const totalInr = perYearInr * term;
        const cost = currency === 'INR' ? totalInr : totalInr / usdInrRate();
        return { cost: parseFloat(cost.toFixed(2)), estimated: false };
      }
    }
  }

  const marginRatio = PRODUCT_MARGIN_RATIOS[typeKey] || 0.35;
  const cost = Math.max(0, price * (1 - marginRatio));
  return { cost: parseFloat(cost.toFixed(2)), estimated: true };
}

/**
 * Back-compatible wrapper returning just the number.
 */
export function estimateItemWholesaleCost(
  productType: string,
  description: string,
  price: number,
  currency: string,
  costTable?: DomainCostTable,
  years?: number
): number {
  return estimateItemWholesaleCostDetailed(productType, description, price, currency, costTable, years).cost;
}

/**
 * Calculate line-by-line financial metrics for a single order.
 */
/**
 * GST the upstream supplier adds to our cost price. ResellerClub bills
 * Rs599.00 + Rs107.82 = Rs706.82 on a .co.in, and the panel shows that split
 * under "Cost Price Breakup".
 *
 * This is NOT added to COGS. A GST-registered business reclaims it as input
 * tax credit against the GST it collects, so the economic cost of that domain
 * is Rs599. It is tracked here so the cash outflow and the credit position are
 * visible, and because on a zero-rated LUT export there is no output GST to
 * offset it against - see `itcAccumulating`.
 */
const INPUT_GST_RATE = 0.18;

export function calculateOrderFinancials(order: any, costTable?: DomainCostTable): OrderFinancialSummary {
  const currency = order.currency || 'USD';
  const grossAmount = parseFloat(order.totalAmount || 0);
  const taxAmount = parseFloat(order.taxAmount || 0);
  const netSales = parseFloat(order.subtotalAmount || (grossAmount - taxAmount)) || (grossAmount - taxAmount);

  const items = (order.items || []).map((item: any) => {
    const retailPrice = parseFloat(item.price || 0);
    const costResult = estimateItemWholesaleCostDetailed(
      item.productType,
      item.description || '',
      retailPrice,
      currency,
      costTable,
      item.years
    );
    const wholesaleCost = costResult.cost;
    // Margin deliberately excludes input GST on both sides: the sale is
    // measured net of the GST we collect, so the cost is measured net of the
    // GST we pay. Adding it to cost here would understate every margin.
    const inputGst = parseFloat((wholesaleCost * INPUT_GST_RATE).toFixed(2));
    const grossProfit = Math.max(0, parseFloat((retailPrice - wholesaleCost).toFixed(2)));
    const marginPercent = retailPrice > 0 ? parseFloat(((grossProfit / retailPrice) * 100).toFixed(1)) : 0;

    return {
      id: item.id,
      productType: item.productType,
      description: item.description,
      retailPrice,
      wholesaleCost,
      /**
       * True when this cost came from a margin ratio rather than upstream.
       * Surfaced so the console can mark the figure as an estimate instead of
       * presenting a guess as a measured cost.
       */
      costEstimated: costResult.estimated,
      inputGst,
      grossProfit,
      marginPercent,
      currency,
    };
  });

  const totalCost = items.reduce((acc: number, it: any) => acc + it.wholesaleCost, 0);
  // Any estimated line makes the ORDER's cost an estimate: a total is only as
  // sound as its weakest component.
  const costEstimated = items.some((it: any) => it.costEstimated);
  const grossProfit = Math.max(0, parseFloat((netSales - totalCost).toFixed(2)));
  const marginPercent = netSales > 0 ? parseFloat(((grossProfit / netSales) * 100).toFixed(1)) : 0;

  const inputGstPaid = parseFloat(
    items.reduce((acc: number, it: any) => acc + it.inputGst, 0).toFixed(2)
  );

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    currency,
    grossAmount,
    taxAmount,
    netSales,
    totalCost: parseFloat(totalCost.toFixed(2)),
    costEstimated,
    grossProfit,
    marginPercent,
    inputGstPaid,
    cashCost: parseFloat((totalCost + inputGstPaid).toFixed(2)),
    netGstPosition: parseFloat((taxAmount - inputGstPaid).toFixed(2)),
    itcAccumulating: taxAmount === 0 && inputGstPaid > 0,
    items,
  };
}

/**
 * Compute consolidated P&L report across all orders with period filtering.
 */
export function computeFinancialReport(
  orders: any[],
  periodFilter: 'all' | '30d' | '7d' | 'mtd' = 'all',
  costTable?: DomainCostTable
): FinancialAnalyticsReport {
  const now = new Date();
  let filterDate: Date | null = null;

  if (periodFilter === '7d') {
    filterDate = new Date(now.getTime() - 7 * 86400000);
  } else if (periodFilter === '30d') {
    filterDate = new Date(now.getTime() - 30 * 86400000);
  } else if (periodFilter === 'mtd') {
    filterDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const eligibleOrders = orders.filter((o) => {
    if (!filterDate) return true;
    const created = new Date(o.createdAt);
    return created >= filterDate;
  });

  const inrOrders = eligibleOrders.filter((o) => (o.currency || 'USD') === 'INR');
  const usdOrders = eligibleOrders.filter((o) => (o.currency || 'USD') === 'USD');

  const inrPaid = inrOrders.filter((o) => o.paymentStatus === 'PAID');
  const usdPaid = usdOrders.filter((o) => o.paymentStatus === 'PAID');

  // Compute INR aggregations
  let inrTurnover = 0;
  let inrNetSales = 0;
  let inrTax = 0;
  let inrCgst = 0;
  let inrSgst = 0;
  let inrIgst = 0;
  let inrCogs = 0;
  let inrInputGst = 0;

  for (const o of inrPaid) {
    const fin = calculateOrderFinancials(o, costTable);
    inrTurnover += fin.grossAmount;
    inrNetSales += fin.netSales;
    inrTax += fin.taxAmount;
    inrCgst += parseFloat(o.cgstAmount || 0);
    inrSgst += parseFloat(o.sgstAmount || 0);
    inrIgst += parseFloat(o.igstAmount || 0);
    inrCogs += fin.totalCost;
    inrInputGst += fin.inputGstPaid;
  }

  const inrGrossProfit = Math.max(0, inrNetSales - inrCogs);
  const inrMargin = inrNetSales > 0 ? (inrGrossProfit / inrNetSales) * 100 : 0;
  const inrAov = inrPaid.length > 0 ? inrTurnover / inrPaid.length : 0;

  // Compute USD aggregations
  let usdTurnover = 0;
  let usdNetSales = 0;
  let usdTax = 0;
  let usdCogs = 0;
  let usdInputGst = 0;
  let usdBlockedItc = 0;
  let usdLutExport = 0;

  for (const o of usdPaid) {
    const fin = calculateOrderFinancials(o, costTable);
    usdTurnover += fin.grossAmount;
    usdNetSales += fin.netSales;
    usdTax += fin.taxAmount;
    usdCogs += fin.totalCost;
    usdInputGst += fin.inputGstPaid;
    if ((o.taxType || '') === 'LUT_EXPORT' || o.taxAmount === 0) {
      usdLutExport += fin.grossAmount;
      // Zero-rated sale, but the supplier still charged us GST on the cost.
      // That credit has no output liability on this order to offset, so it
      // accumulates until a refund is claimed.
      usdBlockedItc += fin.inputGstPaid;
    }
  }

  const usdGrossProfit = Math.max(0, usdNetSales - usdCogs);
  const usdMargin = usdNetSales > 0 ? (usdGrossProfit / usdNetSales) * 100 : 0;
  const usdAov = usdPaid.length > 0 ? usdTurnover / usdPaid.length : 0;

  // Consolidated INR equivalents
  const consTurnover = inrTurnover + usdTurnover * usdInrRate();
  const consNetSales = inrNetSales + usdNetSales * usdInrRate();
  const consCogs = inrCogs + usdCogs * usdInrRate();
  const consGrossProfit = Math.max(0, consNetSales - consCogs);
  const consMargin = consNetSales > 0 ? (consGrossProfit / consNetSales) * 100 : 0;

  // Product Category breakdown
  const categoryMap: Record<string, { label: string; count: number; revInr: number; profInr: number }> = {
    DOMAIN: { label: 'Domain Registrations', count: 0, revInr: 0, profInr: 0 },
    HOSTING: { label: 'Cloud & Web Hosting', count: 0, revInr: 0, profInr: 0 },
    SERVER: { label: 'VPS & Dedicated Servers', count: 0, revInr: 0, profInr: 0 },
    SECURITY_EMAIL: { label: 'Security & Business Email', count: 0, revInr: 0, profInr: 0 },
  };

  const allPaid = eligibleOrders.filter((o) => o.paymentStatus === 'PAID');
  for (const o of allPaid) {
    const rate = (o.currency || 'USD') === 'INR' ? 1 : usdInrRate();
    for (const item of o.items || []) {
      const type = (item.productType || '').toUpperCase();
      let cat = 'HOSTING';
      if (type.includes('DOMAIN')) cat = 'DOMAIN';
      else if (type.includes('VPS') || type.includes('DEDICATED')) cat = 'SERVER';
      else if (type.includes('SECURITY') || type.includes('EMAIL') || type.includes('SSL')) cat = 'SECURITY_EMAIL';

      const priceInr = parseFloat(item.price || 0) * rate;
      const costInr = estimateItemWholesaleCost(item.productType, item.description || '', parseFloat(item.price || 0), o.currency || 'USD') * rate;
      const profInr = Math.max(0, priceInr - costInr);

      categoryMap[cat].count += 1;
      categoryMap[cat].revInr += priceInr;
      categoryMap[cat].profInr += profInr;
    }
  }

  const totalCatRevenue = Object.values(categoryMap).reduce((acc, c) => acc + c.revInr, 0) || 1;
  const productBreakdown = Object.entries(categoryMap).map(([k, v]) => ({
    category: k,
    label: v.label,
    salesCount: v.count,
    revenueInr: Math.round(v.revInr),
    profitInr: Math.round(v.profInr),
    sharePercent: Math.round((v.revInr / totalCatRevenue) * 100),
  }));

  return {
    period: periodFilter,
    orderCount: eligibleOrders.length,
    paidOrderCount: allPaid.length,
    inr: {
      turnover: Math.round(inrTurnover),
      netSales: Math.round(inrNetSales),
      taxCollected: Math.round(inrTax),
      cgst: Math.round(inrCgst),
      sgst: Math.round(inrSgst),
      igst: Math.round(inrIgst),
      cogs: Math.round(inrCogs),
      // GST the supplier charged us, reclaimable against taxCollected. Not a
      // cost, so it is outside cogs and outside margin.
      inputGst: Math.round(inrInputGst),
      netGstPayable: Math.round(inrTax - inrInputGst),
      grossProfit: Math.round(inrGrossProfit),
      marginPercent: parseFloat(inrMargin.toFixed(1)),
      aov: Math.round(inrAov),
    },
    usd: {
      turnover: parseFloat(usdTurnover.toFixed(2)),
      netSales: parseFloat(usdNetSales.toFixed(2)),
      taxCollected: parseFloat(usdTax.toFixed(2)),
      lutExportSales: parseFloat(usdLutExport.toFixed(2)),
      cogs: parseFloat(usdCogs.toFixed(2)),
      inputGst: parseFloat(usdInputGst.toFixed(2)),
      // Export sales are zero-rated, so this credit cannot be set against
      // output tax and must be refunded. Until it is, it is working capital
      // tied up - and if it is never claimed, a real cost on export margin.
      blockedItcOnExports: parseFloat(usdBlockedItc.toFixed(2)),
      grossProfit: parseFloat(usdGrossProfit.toFixed(2)),
      marginPercent: parseFloat(usdMargin.toFixed(1)),
      aov: parseFloat(usdAov.toFixed(2)),
    },
    consolidatedInr: {
      turnover: Math.round(consTurnover),
      netSales: Math.round(consNetSales),
      cogs: Math.round(consCogs),
      grossProfit: Math.round(consGrossProfit),
      marginPercent: parseFloat(consMargin.toFixed(1)),
    },
    productBreakdown,
  };
}

/**
 * Compute expiration lifecycle metrics across domains and hosting accounts.
 */
export function computeExpirationAnalytics(
  domains: any[],
  hosting: any[]
): ExpirationAnalyticsSummary {
  const now = Date.now();
  const dayMs = 86400000;
  const items: ServiceExpiryInfo[] = [];

  let expiredCount = 0;
  let criticalCount = 0; // 0 to 7 days
  let warningCount = 0;  // 8 to 30 days
  let normalCount = 0;   // > 30 days

  const bucket = (): ExpirationBuckets => ({ expired: 0, critical: 0, warning: 0, normal: 0, total: 0 });
  const domainBuckets = bucket();
  const hostingBuckets = bucket();

  const tally = (b: ExpirationBuckets, urgency: string) => {
    if (urgency === 'EXPIRED') b.expired++;
    else if (urgency === 'CRITICAL') b.critical++;
    else if (urgency === 'WARNING') b.warning++;
    else b.normal++;
    b.total++;
  };

  // 1. Process Domains
  for (const d of domains) {
    const expTime = new Date(d.expiryDate).getTime();
    const diffDays = Math.ceil((expTime - now) / dayMs);

    let urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL';
    if (diffDays < 0) {
      urgency = 'EXPIRED';
      expiredCount++;
    } else if (diffDays <= 7) {
      urgency = 'CRITICAL';
      criticalCount++;
    } else if (diffDays <= 30) {
      urgency = 'WARNING';
      warningCount++;
    } else {
      normalCount++;
    }

    tally(domainBuckets, urgency);

    items.push({
      id: d.id,
      name: d.domainName,
      serviceType: 'DOMAIN',
      planOrTld: d.tld || ('.' + d.domainName.split('.').pop()),
      customerName: d.user?.name || 'Customer',
      customerEmail: d.user?.email || '',
      expiryDate: d.expiryDate,
      daysRemaining: diffDays,
      status: d.status || 'ACTIVE',
      urgency,
      autoRenew: d.autoRenew !== false,
    });
  }

  // 2. Process Hosting Accounts
  for (const h of hosting) {
    const dueTime = new Date(h.nextDueDate || h.createdAt).getTime();
    const diffDays = Math.ceil((dueTime - now) / dayMs);

    let urgency: 'EXPIRED' | 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL';
    if (diffDays < 0) {
      urgency = 'EXPIRED';
      expiredCount++;
    } else if (diffDays <= 7) {
      urgency = 'CRITICAL';
      criticalCount++;
    } else if (diffDays <= 30) {
      urgency = 'WARNING';
      warningCount++;
    } else {
      normalCount++;
    }

    tally(hostingBuckets, urgency);

    items.push({
      id: h.id,
      name: h.domainName || h.planName,
      serviceType: 'HOSTING',
      planOrTld: h.planName || h.productType,
      customerName: h.user?.name || 'Customer',
      customerEmail: h.user?.email || '',
      expiryDate: h.nextDueDate || h.createdAt,
      daysRemaining: diffDays,
      status: h.status || 'ACTIVE',
      urgency,
      autoRenew: true,
    });
  }

  // Sort with most urgent (earliest expiry / expired) at the top
  items.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    totalServices: domains.length + hosting.length,
    expiredCount,
    criticalCount,
    warningCount,
    normalCount,
    totalRequiringAttention: expiredCount + criticalCount + warningCount,
    expiringItems: items,
    domains: domainBuckets,
    hosting: hostingBuckets,
  };
}
