import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the deployed site.
 *
 * They run against production by default because the database and the upstream
 * API are only reachable from the server; a local run would fail every
 * database-backed route for reasons that have nothing to do with the code.
 *
 * Everything here is READ-ONLY. No test places an order, signs into the admin
 * console or mutates data: a test that creates a real order and a real card
 * charge is not a test, it is a transaction.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // Be a considerate guest on a live site.
  workers: 4,
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'https://hostmattic.com',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
