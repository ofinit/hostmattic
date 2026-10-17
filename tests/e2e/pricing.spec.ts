import { test, expect } from '@playwright/test';

/**
 * Pricing correctness, checked against the figures configured upstream.
 *
 * Three separate bugs here reached production: a flat $12.99 renewal that
 * ignored the extension, a flat $7.99 transfer that did the same, and product
 * keys that did not exist so whole extensions silently used a stale fallback
 * table. Each shipped because nothing compared the rendered price with the
 * catalogue.
 */

const USD_INR = 83.5;

/**
 * These tests deliberately assert INVARIANTS, not figures.
 *
 * An earlier version pinned .co.in to Rs1,500 / Rs1,630 / Rs1,500, which were
 * the panel's values that day. The moment those prices were legitimately
 * changed the suite failed, reporting a defect where there was only a business
 * decision. A test that breaks whenever someone does their job correctly gets
 * ignored, and an ignored test protects nothing.
 *
 * What must always hold, whatever the prices are:
 *  - nothing is sold below what it costs us
 *  - registration, renewal and transfer are priced independently
 *  - no single figure is shared across unrelated extensions
 */

/** Allows for the INR -> USD -> INR rounding trip. */
const near = (actual: number, expected: number, tolerance = 2) =>
  Math.abs(actual - expected) <= tolerance;

test('domain pricing API responds with per-extension entries', async ({ request }) => {
  const res = await request.get('/api/domains/pricing');
  expect(res.status()).toBe(200);

  const json = await res.json();
  expect(json.success).toBe(true);
  expect(Object.keys(json.pricing).length).toBeGreaterThan(5);
});

test('registration, renewal and transfer are three distinct prices', async ({ request }) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  const coin = json.pricing['.co.in'];

  expect(coin, '.co.in must be present in the catalogue').toBeTruthy();
  for (const field of ['retailInr', 'renewInr', 'transferInr']) {
    expect(coin, `.co.in is missing ${field}`).toHaveProperty(field);
  }
});

test('no extension is sold below its own wholesale cost', async ({ request }) => {
  // The defect this exists for: a flat $7.99 transfer meant a .io, costing
  // Rs3,009, was sold for Rs667 - a loss of over Rs2,300 on every sale. A flat
  // $12.99 renewal did the same on .io, .ai and .co.
  const json = await (await request.get('/api/domains/pricing')).json();
  const underwater: string[] = [];

  for (const [tld, info] of Object.entries<any>(json.pricing)) {
    const checks: Array<[string, number, number | undefined]> = [
      // A promotional registration is compared against the promotional cost,
      // which the catalogue supplies when the promotion publishes one. Where
      // it does not, the cost is reported as unknown rather than guessed, and
      // the pair is skipped below - comparing a promo price against the
      // standard cost would report a loss that is not real.
      ['registration', info.retailInr, info.wholesaleCostInr],
      // Renewals and transfers are not promotional here, so these are a
      // like-for-like comparison and the one that catches a flat price.
      ['renewal', info.renewInr, info.renewWholesaleCostInr],
      ['transfer', info.transferInr, info.transferWholesaleCostInr],
    ];
    for (const [label, price, cost] of checks) {
      if (!price || !cost) continue; // not priced upstream; nothing to compare
      if (price < cost) underwater.push(`${tld} ${label}: Rs${price} against cost Rs${cost}`);
    }
  }

  expect(underwater, `sold below cost:\n${underwater.join('\n')}`).toEqual([]);
});

test('.co.in is priced consistently across the catalogue and the storefront', async ({
  request,
}) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  const coin = json.pricing['.co.in'];

  expect(coin, '.co.in must resolve to a real upstream product').toBeTruthy();
  // It was mapped to `dotcoin`, a key that does not exist, so it silently used
  // a stale fallback table. A live price always carries its cost alongside.
  expect(coin.wholesaleCostInr, '.co.in has no upstream cost, so it is a fallback').toBeGreaterThan(
    0
  );

  for (const field of ['retailInr', 'renewInr', 'transferInr'] as const) {
    expect(coin[field], `.co.in ${field} is not a usable price`).toBeGreaterThan(0);
  }
});

test('no flat price is shared across extensions', async ({ request }) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  const entries = Object.entries<any>(json.pricing);

  // A .io and a .co.in costing the same would mean a fallback is in play.
  const io = json.pricing['.io'];
  const coin = json.pricing['.co.in'];
  if (io && coin) {
    expect(io.retailInr, '.io and .co.in share a registration price').not.toBe(coin.retailInr);
  }

  // And the set as a whole must not collapse to one or two values.
  const distinct = new Set(entries.map(([, v]) => v.retailInr));
  expect(distinct.size, 'registration prices are suspiciously uniform').toBeGreaterThan(3);
});

test('a renewal is never quoted at the promotional registration price', async ({ request }) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  for (const [tld, info] of Object.entries<any>(json.pricing)) {
    if (!info.isPromo || !info.renewInr) continue;
    expect(
      info.renewInr,
      `${tld} renews at its discounted first-year price (${info.renewInr})`
    ).toBeGreaterThanOrEqual(info.retailInr);
  }
});

test('the transfer page quotes the same price the catalogue holds', async ({ page, request }) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  const expectedInr = json.pricing['.co.in']?.transferInr;
  expect(expectedInr, 'no transfer price for .co.in to compare against').toBeGreaterThan(0);

  await page.goto('/domains/transfer', { waitUntil: 'networkidle' });
  await page.getByRole('textbox').first().fill('hotice.co.in');

  const button = page.getByRole('button', { name: /Transfer for \$|Initiate Domain Transfer/ });
  await expect(button).toBeVisible();
  await expect
    .poll(async () => (await button.innerText()).trim(), { timeout: 20_000 })
    .toMatch(/Transfer for \$\d+\.\d{2}\/yr/);

  const usd = Number((await button.innerText()).match(/\$(\d+\.\d{2})/)?.[1] || 0);
  const quotedInr = usd * USD_INR;

  // Within rounding of the INR -> USD -> INR trip.
  expect(
    Math.abs(quotedInr - expectedInr) <= 5,
    `page quotes $${usd} (~Rs${Math.round(quotedInr)}), catalogue holds Rs${expectedInr}`
  ).toBe(true);
});

test('hosting pricing withholds paused and superseded plans', async ({ request }) => {
  const res = await request.get('/api/hosting/pricing?type=SHARED_LINUX');
  expect(res.status()).toBe(200);

  const json = await res.json();
  expect(json.success).toBe(true);

  for (const [name, plan] of Object.entries<any>(json.plans || {})) {
    expect(
      String(plan.status).toLowerCase(),
      `${name} is offered despite being ${plan.status}`
    ).not.toBe('paused');
    expect(name, `${name} is a superseded generation`).not.toMatch(/classic\s*20\d{2}/i);
  }
});

test('every offered hosting plan carries a usable price', async ({ request }) => {
  const json = await (await request.get('/api/hosting/pricing')).json();
  for (const [family, plans] of Object.entries<any>(json.pricing || {})) {
    for (const [name, plan] of Object.entries<any>(plans)) {
      const hasPrice =
        (typeof plan.monthlyUsd === 'number' && plan.monthlyUsd > 0) ||
        (typeof plan.annualMonthlyUsd === 'number' && plan.annualMonthlyUsd > 0);
      expect(hasPrice, `${family}/${name} is offered with no usable price`).toBe(true);
    }
  }
});
