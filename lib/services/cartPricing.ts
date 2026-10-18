/**
 * Authoritative re-pricing of a cart at checkout.
 *
 * Two holes this closes.
 *
 * The cart is persisted in the browser's localStorage, and each line stores a
 * snapshot of the price at the moment it was added. A cart filled before a
 * price change keeps the old figure indefinitely - a .io transfer added while
 * the flat $7.99 bug was live still quotes Rs667 against a Rs3,009 cost.
 *
 * And checkout took `price` straight from the request body, so the figure that
 * decided what the customer paid was one the browser supplied.
 *
 * Every line is therefore priced again here from the live catalogue and
 * compared with what was submitted. A mismatch stops the order rather than
 * silently correcting it: the totals, the GST split and the gateway amount are
 * all computed from these lines, so the cart has to be rebuilt for them to
 * agree.
 *
 * A line this cannot price - an unmapped product, an extension upstream does
 * not list - is reported as unverified rather than rejected. Blocking every
 * sale we cannot check would be worse than the hole, and the fulfilment guard
 * in the checkout route already refuses what cannot be provisioned.
 */

import { getLiveDomainPricing } from '@/lib/api/pricing';
import { getSellablePlan, PRODUCT_KEYS } from '@/lib/api/hostingPricing';

/** Matches components/CurrencyContext.tsx, which converts the displayed price. */
const USD_INR_RATE = 83.5;

/** Rounding drift through the INR -> USD -> INR round trip is a rupee or so. */
const TOLERANCE_ABSOLUTE = 1;
const TOLERANCE_FRACTION = 0.01;

export interface CartLine {
  type?: string;
  productType?: string;
  name?: string;
  domainName?: string;
  upstreamPlan?: string;
  price?: number;
  period?: string;
  years?: number;
}

export interface LineCheck {
  name: string;
  submitted: number;
  /** In the order's currency, as the client quotes it. */
  expected: number | null;
  status: 'ok' | 'mismatch' | 'unverified';
  detail?: string;
}

/** Longest suffix wins, so hotice.co.in prices as .co.in and not as .in. */
function extensionOf(domain: string, known: string[]): string | null {
  const name = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  let best: string | null = null;
  for (const tld of known) {
    if (name.endsWith(tld) && (!best || tld.length > best.length)) best = tld;
  }
  return best;
}

/** Registration, renewal and transfer are three different prices. */
function domainAction(name: string): 'transfer' | 'renew' | 'register' {
  const n = name.toLowerCase();
  if (n.includes('transfer')) return 'transfer';
  if (n.includes('renew')) return 'renew';
  return 'register';
}

async function expectedUsdFor(
  line: CartLine
): Promise<{ usd: number | null; inr?: number; detail?: string }> {
  const label = line.name || line.domainName || 'item';

  if (line.type === 'DOMAIN') {
    const pricing = await getLiveDomainPricing();
    const target = line.domainName || line.name || '';
    const tld = extensionOf(target, Object.keys(pricing));
    if (!tld) return { usd: null, detail: `no catalogue entry for ${label}` };

    const info = pricing[tld];
    const action = domainAction(line.name || '');
    const unit =
      action === 'transfer' ? info.transferUsd : action === 'renew' ? info.renewUsd : info.retailUsd;

    if (!unit) return { usd: null, detail: `upstream prices no ${action} for ${tld}` };

    const years = Number(line.years) > 0 ? Number(line.years) : 1;

    // The catalogue holds rupees; comparing in them avoids the round trip that
    // turned Rs750 into Rs749.83.
    const unitInr =
      action === 'transfer' ? info.transferInr : action === 'renew' ? info.renewInr : info.retailInr;

    return { usd: unit * years, inr: unitInr ? unitInr * years : undefined };
  }

  // Plan-based products all arrive as type HOSTING from the pricing cards.
  const productType = (line.productType || '').toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(PRODUCT_KEYS, productType)) {
    return { usd: null, detail: `${label} is not a priced product family` };
  }

  // The cart carries the upstream plan name; the page's own tier name is a
  // marketing label that upstream has never heard of.
  const planName = line.upstreamPlan || line.name || '';
  const plan = await getSellablePlan(productType, planName);
  if (!plan) return { usd: null, detail: `${label} is not available upstream` };

  const monthly = String(line.period || '').toLowerCase().includes('month');
  if (monthly) {
    if (!plan.monthlyUsd) {
      return { usd: null, detail: `${label} is not sold month to month` };
    }
    return { usd: plan.monthlyUsd };
  }

  if (!plan.annualMonthlyUsd) return { usd: null, detail: `${label} has no annual price` };
  return { usd: Number((plan.annualMonthlyUsd * 12).toFixed(2)) };
}

export async function repriceCart(
  items: CartLine[],
  currency: string
): Promise<{ checks: LineCheck[]; mismatches: LineCheck[] }> {
  const rate = currency?.toUpperCase() === 'INR' ? USD_INR_RATE : 1;
  const checks: LineCheck[] = [];

  for (const line of items || []) {
    const label = line.name || line.domainName || 'item';
    const submitted = Number(line.price);

    const { usd, inr, detail } = await expectedUsdFor(line);
    if (usd == null) {
      checks.push({ name: label, submitted, expected: null, status: 'unverified', detail });
      continue;
    }

    // Prefer the exact rupee figure when the order is in rupees.
    const expected =
      rate !== 1 && typeof inr === 'number' && inr > 0
        ? Number(inr.toFixed(2))
        : Number((usd * rate).toFixed(2));
    const tolerance = Math.max(TOLERANCE_ABSOLUTE, expected * TOLERANCE_FRACTION);
    const ok = Number.isFinite(submitted) && Math.abs(submitted - expected) <= tolerance;

    checks.push({
      name: label,
      submitted,
      expected,
      status: ok ? 'ok' : 'mismatch',
      detail: ok ? undefined : 'the price has changed since this was added to the cart',
    });
  }

  return { checks, mismatches: checks.filter((c) => c.status === 'mismatch') };
}
