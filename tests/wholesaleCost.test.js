const test = require('node:test');
const assert = require('node:assert');

const {
  estimateItemWholesaleCostDetailed,
  domainActionOf,
  calculateOrderFinancials,
  USD_TO_INR_RATE,
} = require('../.test-build/analytics/pnl.js');

// A stand-in for what getLiveDomainPricing returns. The numbers are the real
// shape: a separate figure per action, and .co.in priced quite differently
// from .in.
const COSTS = {
  '.com': { wholesaleCostInr: 999, renewWholesaleCostInr: 1050, transferWholesaleCostInr: 999 },
  '.in': { wholesaleCostInr: 689, renewWholesaleCostInr: 850, transferWholesaleCostInr: 689 },
  '.co.in': { wholesaleCostInr: 599, renewWholesaleCostInr: 850, transferWholesaleCostInr: 599 },
  '.io': { wholesaleCostInr: 3009 },
};

test('a .co.in is not costed as a .in', () => {
  // The old substring match hit '.in' first and booked Rs689 for a domain that
  // actually costs Rs599, flattering the margin on every one.
  const r = estimateItemWholesaleCostDetailed(
    'DOMAIN', 'Domain Registration - example.co.in', 813.02, 'INR', COSTS, 1
  );
  assert.strictEqual(r.cost, 599);
  assert.strictEqual(r.estimated, false);
});

test('the longest matching suffix wins, falling back to the shorter one', () => {
  const known = estimateItemWholesaleCostDetailed(
    'DOMAIN', 'Domain Registration - example.in', 779, 'INR', COSTS, 1
  );
  assert.strictEqual(known.cost, 689);

  // .net.in is not in the table; it must fall back to .in, not to nothing.
  const fallback = estimateItemWholesaleCostDetailed(
    'DOMAIN', 'Domain Registration - example.net.in', 779, 'INR', COSTS, 1
  );
  assert.strictEqual(fallback.cost, 689);
});

test('registration, renewal and transfer are priced separately', () => {
  const reg = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Registration - a.in', 779, 'INR', COSTS, 1);
  const ren = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Renewal - a.in', 779, 'INR', COSTS, 1);
  const trf = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Transfer - a.in', 779, 'INR', COSTS, 1);
  assert.strictEqual(reg.cost, 689);
  assert.strictEqual(ren.cost, 850);
  assert.strictEqual(trf.cost, 689);
});

test('a restore is never costed from a renewal', () => {
  // A .co.in costs roughly Rs7,300 to restore against Rs850 to renew.
  // Substituting one for the other is wrong by a multiple, so the line must
  // fall through to an estimate and SAY it is one.
  const r = estimateItemWholesaleCostDetailed(
    'DOMAIN', 'Domain Restore - example.co.in', 9000, 'INR', COSTS, 1
  );
  assert.strictEqual(r.estimated, true);
  assert.notStrictEqual(r.cost, 850);
});

test('term multiplies the cost - upstream quotes one year', () => {
  const one = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Registration - a.in', 779, 'INR', COSTS, 1);
  const three = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Registration - a.in', 2337, 'INR', COSTS, 3);
  assert.strictEqual(one.cost, 689);
  assert.strictEqual(three.cost, 689 * 3);
});

test('a USD order converts the INR cost', () => {
  const r = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Registration - a.io', 40.3, 'USD', COSTS, 1);
  assert.strictEqual(r.cost, parseFloat((3009 / USD_TO_INR_RATE).toFixed(2)));
  assert.strictEqual(r.estimated, false);
});

test('without a cost table the result is flagged as an estimate', () => {
  const r = estimateItemWholesaleCostDetailed('DOMAIN', 'Domain Registration - a.in', 779, 'INR', undefined, 1);
  assert.strictEqual(r.estimated, true);
});

test('an unknown TLD is estimated, not silently priced', () => {
  const r = estimateItemWholesaleCostDetailed(
    'DOMAIN', 'Domain Registration - example.quux', 1200, 'INR', COSTS, 1
  );
  assert.strictEqual(r.estimated, true);
});

test('domainActionOf reads the action out of the description', () => {
  assert.strictEqual(domainActionOf('Domain Registration - a.in'), 'register');
  assert.strictEqual(domainActionOf('Domain Renewal - a.in'), 'renew');
  assert.strictEqual(domainActionOf('Transfer in - a.in'), 'transfer');
  assert.strictEqual(domainActionOf('Domain Restore - a.in'), 'restore');
  assert.strictEqual(domainActionOf(''), 'register');
});

test('order totals use the real cost and carry the estimate flag', () => {
  const order = {
    id: 'o1', orderNumber: 'HMO/2026-27/0001', currency: 'INR',
    totalAmount: 813.02, taxAmount: 124.02, subtotalAmount: 689,
    items: [{ id: 'i1', productType: 'DOMAIN', description: 'Domain Registration - chaitanyaholidayhomes.in', price: 689, years: 1 }],
  };

  const withCosts = calculateOrderFinancials(order, COSTS);
  assert.strictEqual(withCosts.totalCost, 689);
  assert.strictEqual(withCosts.costEstimated, false);
  // Net sales equal cost here, so the margin is zero rather than the 59.6%
  // the hardcoded table used to produce.
  assert.strictEqual(withCosts.grossProfit, 0);

  const withoutCosts = calculateOrderFinancials(order);
  assert.strictEqual(withoutCosts.costEstimated, true);
});

test('a non-domain line still uses the margin ratio and is marked estimated', () => {
  const r = estimateItemWholesaleCostDetailed('SHARED_LINUX', 'Business Cloud Hosting', 1000, 'INR', COSTS, 1);
  assert.strictEqual(r.cost, 500); // 50% ratio
  assert.strictEqual(r.estimated, true);
});
