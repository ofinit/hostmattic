const test = require('node:test');
const assert = require('node:assert');

const {
  toMoney,
  unitPriceFor,
  annualInrFrom,
  pricingLineFor,
} = require('../.test-build/pricing/cartLine.js');

const RATE = 83.5;

// The real line from production: a .in renewal added at Rs1,880, stored in the
// cart as dollars because the renewal path never set priceAnnualInr.
const STALE_RENEWAL = {
  type: 'DOMAIN',
  name: 'Domain Renewal - crescendotech.in',
  domainName: 'crescendotech.in',
  billingPeriod: 'annual',
  priceAnnual: 22.51,
  priceMonthly: 1.88,
};

test('a dollar price converted to rupees is rounded to paise', () => {
  // 22.51 * 83.5 is 1879.5885000000001 in binary floating point. That figure
  // was travelling to the server, the gateway and the tax invoice.
  assert.strictEqual(unitPriceFor(STALE_RENEWAL, 'INR', RATE), 1879.59);
});

test('the catalogue rupee price is used as-is, never round-tripped', () => {
  const line = { ...STALE_RENEWAL, priceAnnualInr: 1880 };
  // Not 1879.59: the rupee figure is authoritative when the line carries one.
  assert.strictEqual(unitPriceFor(line, 'INR', RATE), 1880);
});

test('a monthly line divides the annual rupee price by twelve', () => {
  const line = { billingPeriod: 'monthly', priceAnnualInr: 1200, priceMonthly: 1.2 };
  assert.strictEqual(unitPriceFor(line, 'INR', RATE), 100);
});

test('a USD order ignores the rupee price entirely', () => {
  const line = { ...STALE_RENEWAL, priceAnnualInr: 1880 };
  assert.strictEqual(unitPriceFor(line, 'USD', 1), 22.51);
});

test('a missing price is zero rather than NaN', () => {
  // NaN would survive every arithmetic check downstream and reach the gateway.
  assert.strictEqual(unitPriceFor({ billingPeriod: 'annual' }, 'INR', RATE), 0);
});

test('annualInrFrom keeps an annual figure and scales a monthly one', () => {
  assert.strictEqual(annualInrFrom(779, 'annual', 'INR'), 779);
  assert.strictEqual(annualInrFrom(100, 'monthly', 'INR'), 1200);
});

test('annualInrFrom returns nothing for a dollar order', () => {
  // There is no rupee figure to keep, and storing the dollar amount as one
  // would make every later rupee total wrong by a factor of the rate.
  assert.strictEqual(annualInrFrom(9.33, 'annual', 'USD'), undefined);
  assert.strictEqual(annualInrFrom(0, 'annual', 'INR'), undefined);
});

test('the line sent for pricing carries what the server needs to price it', () => {
  const line = pricingLineFor(STALE_RENEWAL, 'INR', RATE);
  assert.strictEqual(line.type, 'DOMAIN');
  assert.strictEqual(line.domainName, 'crescendotech.in');
  assert.strictEqual(line.period, '1 Year');
  assert.strictEqual(line.price, 1879.59);
  // The name carries the action: the server reads "Renewal" out of it to pick
  // the renewal price rather than the registration price.
  assert.match(line.name, /Renewal/);
});

test('a domain line with no explicit domainName falls back to the name', () => {
  const line = pricingLineFor(
    { type: 'DOMAIN', name: 'example.in', billingPeriod: 'annual', priceAnnual: 10 },
    'USD',
    1
  );
  assert.strictEqual(line.domainName, 'example.in');
});

test('a non-domain line defaults to the SERVICE product type', () => {
  const line = pricingLineFor(
    { type: 'SECURITY', name: 'SiteLock', billingPeriod: 'monthly', priceMonthly: 5 },
    'USD',
    1
  );
  assert.strictEqual(line.productType, 'SERVICE');
  assert.strictEqual(line.domainName, undefined);
  assert.strictEqual(line.period, '1 Month');
});

test('toMoney cuts the floating point tail', () => {
  assert.strictEqual(toMoney(1879.5885000000001), 1879.59);
  assert.strictEqual(toMoney(0.1 + 0.2), 0.3);
});
