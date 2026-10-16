import { test, expect, Page } from '@playwright/test';

/**
 * Checkout behaviour and mobile layout.
 *
 * Nothing here submits an order. The drawer is opened and inspected; the pay
 * button is never pressed.
 */

/** Puts one domain transfer in the basket and opens the drawer, in rupees. */
async function openDrawerWithItem(page: Page) {
  // networkidle, not domcontentloaded: the currency control is a React button,
  // and clicking it before hydration lands on inert markup and does nothing -
  // which left the drawer in USD and looked like a missing GST section.
  await page.goto('/domains/transfer', { waitUntil: 'networkidle' });

  // A fresh visitor starts in USD, where the sale is zero-rated under LUT and
  // no GST applies at all. The assertions below are about the rupee path, so
  // the currency is chosen explicitly - and confirmed, so a click that
  // silently failed cannot be mistaken for a defect in the page.
  await page.getByRole('button', { name: /INR/ }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('hm_currency')), { timeout: 15_000 })
    .toBe('INR');

  // Both fields are required. The EPP authorisation code is not optional: the
  // registry rejects a transfer without it, so the form will not submit until
  // it is supplied.
  const inputs = page.getByRole('textbox');
  await inputs.nth(0).fill('hotice.co.in');
  await inputs.nth(1).fill('TEST-EPP-CODE-0000');

  const button = page.getByRole('button', { name: /Transfer for \$|Initiate Domain Transfer/ });
  await expect
    .poll(async () => (await button.innerText()).includes('Transfer for $'), { timeout: 20_000 })
    .toBe(true);

  await button.click();
  await expect(page.getByText('Hostmattic Express Checkout')).toBeVisible({ timeout: 15_000 });
}

test('the state field is not preselected', async ({ page }) => {
  // Place of supply decides CGST+SGST against IGST. Defaulting it to the
  // seller's own state billed out-of-state customers the wrong tax.
  await openDrawerWithItem(page);

  const stateSelect = page.locator('select').filter({ hasText: /Select your state|Kerala/ }).first();
  await expect(stateSelect).toBeVisible();

  const value = await stateSelect.inputValue();
  expect(value, 'a state is preselected; the customer must choose').toBe('');
});

test('GST is shown while the split awaits a state', async ({ page }) => {
  await openDrawerWithItem(page);

  // Both splits total the same 18%, so the amount is knowable; only the
  // CGST/SGST against IGST breakdown depends on the state.
  await expect(page.getByText(/Select your state to complete the invoice/i)).toBeVisible();
  await expect(page.getByText(/GST \(18%\)/i)).toBeVisible();
});

test('payment is blocked until a place of supply is chosen', async ({ page }) => {
  await openDrawerWithItem(page);

  const pay = page.getByRole('button', { name: /Pay .* & Provision Services/ });
  await expect(pay).toBeVisible();
  await expect(pay, 'pay is enabled without a place of supply').toBeDisabled();
});

test('the total renders to two decimal places', async ({ page }) => {
  await openDrawerWithItem(page);

  const pay = page.getByRole('button', { name: /Pay .* & Provision Services/ });
  const label = await pay.innerText();

  // Rs1,769.6 was being shown for Rs1,769.60.
  // Rs1,769.6 was being shown for Rs1,769.60; the point is two decimal places
  // in whichever currency is active.
  expect(label, `pay button reads "${label.trim()}"`).toMatch(/[₹$][\d,]+\.\d{2}/);
});

test('the basket shows the live transfer price, not a stale one', async ({ page }) => {
  await openDrawerWithItem(page);

  const drawer = page.getByText('Selected Products & Services').locator('..');
  const text = await drawer.innerText();

  // Rs667 was the flat $7.99 that ignored the extension.
  expect(text, 'the basket is quoting the old flat transfer price').not.toMatch(/₹\s?667/);
});

for (const route of ['/', '/hosting/shared-linux']) {
  test(`no horizontal scroll at 360px: ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});

    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return { scroll: d.scrollWidth, client: d.clientWidth };
    });

    expect(
      overflow.scroll,
      `${route} scrolls horizontally at 360px (${overflow.scroll}px content in ${overflow.client}px)`
    ).toBeLessThanOrEqual(overflow.client + 2);
  });
}
