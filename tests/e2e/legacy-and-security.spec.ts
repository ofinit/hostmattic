import { test, expect } from '@playwright/test';

/**
 * Legacy SuperSite URLs and client-bundle secret hygiene.
 */

// The old PHP storefront is still linked from the upstream customer panel.
const LEGACY_PATHS = [
  '/reseller.php?action=validate_res_buy&p=home',
  '/buy.php?r=customer&p=domtransfer',
  '/cart.php',
  '/index.php',
  '/something-that-never-existed.php',
];

for (const path of LEGACY_PATHS) {
  test(`legacy URL does not 404: ${path}`, async ({ request }) => {
    const res = await request.get(path);
    expect(res.status(), `${path} returned ${res.status()}`).not.toBe(404);
    expect(res.status()).toBeLessThan(400);
  });
}

/**
 * Secrets must never reach the browser.
 *
 * Next.js inlines anything prefixed NEXT_PUBLIC_ into the client bundle, so a
 * gateway secret placed in the wrong variable would be readable by every
 * visitor. These assert the actual shipped JavaScript.
 */
test('no server secret appears in the client bundle', async ({ page }) => {
  const scripts: string[] = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (!/\.js(\?|$)/.test(url)) return;
    if (!url.includes('/_next/')) return;
    try {
      scripts.push(await res.text());
    } catch {
      // A script that cannot be read cannot be scanned; ignore it.
    }
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  await page.goto('/checkout', { waitUntil: 'networkidle' }).catch(() => {});

  expect(scripts.length, 'no client bundles were captured').toBeGreaterThan(0);
  const all = scripts.join('\n');

  // Patterns that would indicate a real secret, not merely the variable name.
  const leaks: Array<[string, RegExp]> = [
    ['Razorpay live/test secret', /rzp_(live|test)_[A-Za-z0-9]{10,}/],
    ['Instamojo auth token', /INSTAMOJO_AUTH_TOKEN["']?\s*[:=]\s*["'][^"']{8,}/],
    ['settings encryption key', /SETTINGS_ENCRYPTION_KEY["']?\s*[:=]\s*["'][0-9a-f]{32,}/i],
    ['reseller API key', /RESELLER_API_KEY["']?\s*[:=]\s*["'][^"']{8,}/],
    ['JWT secret', /JWT_SECRET["']?\s*[:=]\s*["'][^"']{8,}/],
    ['database URL', /postgres(ql)?:\/\/[^"'\s]+:[^"'\s]+@/],
  ];

  for (const [label, pattern] of leaks) {
    const hit = all.match(pattern);
    expect(hit?.[0] ? `${label}: ${hit[0].slice(0, 24)}…` : null, `${label} found in client JS`).toBeNull();
  }
});

test('the pricing diagnostics endpoint is not public', async ({ request }) => {
  const res = await request.get('/api/admin/pricing-diagnostics?audit=1');
  expect([401, 403], `returned ${res.status()} anonymously`).toContain(res.status());

  const body = await res.text();
  expect(
    /singledomainhosting|thirdleveldotin|planLikeKeys/i.test(body),
    'upstream catalogue keys leaked to an anonymous caller'
  ).toBe(false);
});
