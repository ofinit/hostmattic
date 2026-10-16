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

/** From the reseller panel, .IN 3rd Level Domain Names, 1 year. */
const CO_IN = { register: 1500, renew: 1630, transfer: 1500 };
const USD_INR = 83.5;

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

test('.co.in matches the prices configured upstream', async ({ request }) => {
  const json = await (await request.get('/api/domains/pricing')).json();
  const coin = json.pricing['.co.in'];

  expect(
    near(coin.transferInr, CO_IN.transfer),
    `transfer was ${coin.transferInr}, panel says ${CO_IN.transfer}`
  ).toBe(true);
  expect(
    near(coin.renewInr, CO_IN.renew),
    `renewal was ${coin.renewInr}, panel says ${CO_IN.renew}`
  ).toBe(true);
  expect(
    near(coin.retailInr, CO_IN.register),
    `registration was ${coin.retailInr}, panel says ${CO_IN.register}`
  ).toBe(true);
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

test('the transfer page quotes a live per-extension price', async ({ page }) => {
  await page.goto('/domains/transfer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox').first().fill('hotice.co.in');

  // The button carries the price once the catalogue has loaded.
  const button = page.getByRole('button', { name: /Transfer for \$|Initiate Domain Transfer/ });
  await expect(button).toBeVisible();

  await expect
    .poll(async () => (await button.innerText()).trim(), { timeout: 20_000 })
    .toMatch(/Transfer for \$\d+\.\d{2}\/yr/);

  const label = await button.innerText();
  const usd = Number(label.match(/\$(\d+\.\d{2})/)?.[1] || 0);
  expect(
    near(usd * USD_INR, CO_IN.transfer, 5),
    `transfer quoted $${usd} (~Rs${Math.round(usd * USD_INR)}), panel says Rs${CO_IN.transfer}`
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
