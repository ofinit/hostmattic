import { test, expect, Page } from '@playwright/test';

/**
 * Every public route must render without an uncaught client exception.
 *
 * This is the class of failure that blanked the admin console with React
 * error #310: the server returns 200, the HTML arrives, and then hydration
 * throws and the user sees nothing. A status-code check alone would have
 * passed while the page was unusable.
 */

const ROUTES = [
  '/',
  '/domains',
  '/domains/transfer',
  '/domains/new-gtlds',
  '/hosting/shared-linux',
  '/hosting/wordpress',
  '/servers/vps',
  '/servers/dedicated',
  '/email/business',
  '/security/sitelock',
  '/products',
  '/login',
];

/** Collects page errors and genuine console errors, ignoring network noise. */
function watchForErrors(page: Page) {
  const errors: string[] = [];

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // A missing favicon or a blocked third-party beacon is not a defect in
    // the page under test.
    if (/favicon|net::ERR_|Failed to load resource/i.test(text)) return;
    errors.push(`console: ${text}`);
  });

  return errors;
}

for (const route of ROUTES) {
  test(`renders without client exceptions: ${route}`, async ({ page }) => {
    const errors = watchForErrors(page);

    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), `${route} should not be a server error`).toBeLessThan(400);

    // Give hydration a chance to throw.
    await page.waitForLoadState('networkidle').catch(() => {});

    // The Next.js error boundary renders this exact copy.
    await expect(
      page.getByText('Application error: a client-side exception has occurred'),
      `${route} rendered the Next.js client error boundary`
    ).toHaveCount(0);

    expect(errors, `${route} produced client errors:\n${errors.join('\n')}`).toEqual([]);

    // Something must actually be on the page.
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length, `${route} rendered an empty body`).toBeGreaterThan(50);
  });
}
