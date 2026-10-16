import { test, expect } from '@playwright/test';

/**
 * Authentication guards.
 *
 * `/client/dashboard` once rendered the entire customer portal to a signed-out
 * visitor because the only protection was a client-side redirect: the console
 * painted first, and without JavaScript it never redirected at all. The guard
 * belongs in middleware, and these tests assert it is there - the redirect has
 * to happen before any portal markup reaches the browser.
 */

const PROTECTED_PAGES = ['/client/dashboard', '/admin/dashboard'];

for (const path of PROTECTED_PAGES) {
  test(`redirects an anonymous visitor away from ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await expect(page, `${path} must not be viewable signed out`).not.toHaveURL(
      new RegExp(`${path}$`)
    );
  });

  test(`serves no portal markup for ${path} without a session`, async ({ request }) => {
    // Checked at the HTTP level: a client-side redirect would still have sent
    // the full console in the response body.
    const res = await request.get(path, { maxRedirects: 0 });
    const status = res.status();

    if (status >= 300 && status < 400) {
      expect(status, 'a redirect is the correct response').toBeGreaterThanOrEqual(300);
      return;
    }

    const body = await res.text();
    expect(
      /Staff Infrastructure|Customer Control Panel|Super Administrator/i.test(body),
      `${path} returned ${status} containing privileged markup`
    ).toBe(false);
  });
}

test('the admin login page stays reachable', async ({ page }) => {
  const res = await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('admin APIs refuse an anonymous caller', async ({ request }) => {
  for (const endpoint of [
    '/api/admin/overview',
    '/api/admin/settings/payments',
    '/api/admin/pricing-diagnostics',
  ]) {
    const res = await request.get(endpoint);
    expect([401, 403], `${endpoint} returned ${res.status()} to an anonymous caller`).toContain(
      res.status()
    );
  }
});

test('an anonymous caller cannot place an order', async ({ request }) => {
  const res = await request.post('/api/orders/checkout', {
    data: { items: [{ type: 'DOMAIN', name: 'probe.test', price: 1 }], currency: 'INR' },
  });
  expect([401, 403], `checkout returned ${res.status()} to an anonymous caller`).toContain(
    res.status()
  );
});
