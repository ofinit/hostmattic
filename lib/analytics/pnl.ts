/**
 * Hostmattic Financial Analytics & Profit & Loss (P&L) Engine
 *
 * Computes:
 * 1. Line-item wholesale cost of goods sold (COGS) based on upstream catalog.
 * 2. Gross profit and net profit margins across currencies (INR and USD).
 * 3. Statutory GST tax liabilities (CGST + SGST vs IGST vs 0% LUT export).
 * 4. Expiration lifecycle tracking and 30-day renewal alert buckets.
 */

export const USD_TO_INR_RATE = 83.5;

// Wholesale Cost Profiles (ex-tax) based on WebPro Upstream Matrix
const TLD_WHOLESALE_COSTS: Record<string, { inr: number; usd: number }> = {
  '.com': { inr: 999, usd: 10.49 },
  '.in': { inr: 699, usd: 7.49 },
  '.net': { inr: 1144, usd: 11.99 },
  '.org': { inr: 959, usd: 9.99 },
  '.tech': { inr: 879, usd: 8.99 },
  '.online': { inr: 619, usd: 6.49 },
  '.store': { inr: 749, usd: 7.99 },
  '.io': { inr: 3009, usd: 32.00 },
  '.co': { inr: 1749, usd: 18.50 },
  '.ai': { inr: 5999, usd: 65.00 },
};

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
  retailPrice: number;
  wholesaleCost: number;
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
  totalCost: number;       // Wholesale COGS
  grossProfit: number;     // Net Sales - Total Cost
  marginPercent: number;
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

export interface ExpirationAnalyticsSummary {
  totalServices: number;
  expiredCount: number;
  criticalCount: number; // 0 to 7 days
  warningCount: number;  // 8 to 30 days
  normalCount: number;   // > 30 days
  totalRequiringAttention: number; // expired + <= 30 days
  expiringItems: ServiceExpiryInfo[];
}

/**
 * Estimate wholesale cost for a specific order line item.
 */
export function estimateItemWholesaleCost(
  productType: string,
  description: string,
  price: number,
  currency: string
): number {
  const typeKey = (productType || '').toUpperCase();

  // 1. Check for specific domain TLD wholesale match
  if (typeKey === 'DOMAIN' || description.toLowerCase().includes('domain')) {
    const descLower = description.toLowerCase();
    for (const [tld, cost] of Object.entries(TLD_WHOLESALE_COSTS)) {
      if (descLower.includes(tld)) {
        return currency === 'INR' ? cost.inr : cost.usd;
      }
    }
  }

  // 2. Check product margin ratio
  const marginRatio = PRODUCT_MARGIN_RATIOS[typeKey] || 0.35;
  const cost = Math.max(0, price * (1 - marginRatio));
  return parseFloat(cost.toFixed(2));
}

/**
 * Calculate line-by-line financial metrics for a single order.
 */
export function calculateOrderFinancials(order: any): OrderFinancialSummary {
  const currency = order.currency || 'USD';
  const grossAmount = parseFloat(order.totalAmount || 0);
  const taxAmount = parseFloat(order.taxAmount || 0);
  const netSales = parseFloat(order.subtotalAmount || (grossAmount - taxAmount)) || (grossAmount - taxAmount);

  const items = (order.items || []).map((item: any) => {
    const retailPrice = parseFloat(item.price || 0);
    const wholesaleCost = estimateItemWholesaleCost(
      item.productType,
      item.description || '',
      retailPrice,
      currency
    );
    const grossProfit = Math.max(0, parseFloat((retailPrice - wholesaleCost).toFixed(2)));
    const marginPercent = retailPrice > 0 ? parseFloat(((grossProfit / retailPrice) * 100).toFixed(1)) : 0;

    return {
      id: item.id,
      productType: item.productType,
      description: item.description,
      retailPrice,
      wholesaleCost,
      grossProfit,
      marginPercent,
      currency,
    };
  });

  const totalCost = items.reduce((acc: number, it: any) => acc + it.wholesaleCost, 0);
  const grossProfit = Math.max(0, parseFloat((netSales - totalCost).toFixed(2)));
  const marginPercent = netSales > 0 ? parseFloat(((grossProfit / netSales) * 100).toFixed(1)) : 0;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    currency,
    grossAmount,
    taxAmount,
    netSales,
    totalCost: parseFloat(totalCost.toFixed(2)),
    grossProfit,
    marginPercent,
    items,
  };
}

/**
 * Compute consolidated P&L report across all orders with period filtering.
 */
export function computeFinancialReport(
  orders: any[],
  periodFilter: 'all' | '30d' | '7d' | 'mtd' = 'all'
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

  for (const o of inrPaid) {
    const fin = calculateOrderFinancials(o);
    inrTurnover += fin.grossAmount;
    inrNetSales += fin.netSales;
    inrTax += fin.taxAmount;
    inrCgst += parseFloat(o.cgstAmount || 0);
    inrSgst += parseFloat(o.sgstAmount || 0);
    inrIgst += parseFloat(o.igstAmount || 0);
    inrCogs += fin.totalCost;
  }

  const inrGrossProfit = Math.max(0, inrNetSales - inrCogs);
  const inrMargin = inrNetSales > 0 ? (inrGrossProfit / inrNetSales) * 100 : 0;
  const inrAov = inrPaid.length > 0 ? inrTurnover / inrPaid.length : 0;

  // Compute USD aggregations
  let usdTurnover = 0;
  let usdNetSales = 0;
  let usdTax = 0;
  let usdCogs = 0;
  let usdLutExport = 0;

  for (const o of usdPaid) {
    const fin = calculateOrderFinancials(o);
    usdTurnover += fin.grossAmount;
    usdNetSales += fin.netSales;
    usdTax += fin.taxAmount;
    usdCogs += fin.totalCost;
    if ((o.taxType || '') === 'LUT_EXPORT' || o.taxAmount === 0) {
      usdLutExport += fin.grossAmount;
    }
  }

  const usdGrossProfit = Math.max(0, usdNetSales - usdCogs);
  const usdMargin = usdNetSales > 0 ? (usdGrossProfit / usdNetSales) * 100 : 0;
  const usdAov = usdPaid.length > 0 ? usdTurnover / usdPaid.length : 0;

  // Consolidated INR equivalents
  const consTurnover = inrTurnover + usdTurnover * USD_TO_INR_RATE;
  const consNetSales = inrNetSales + usdNetSales * USD_TO_INR_RATE;
  const consCogs = inrCogs + usdCogs * USD_TO_INR_RATE;
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
    const rate = (o.currency || 'USD') === 'INR' ? 1 : USD_TO_INR_RATE;
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
  };
}
