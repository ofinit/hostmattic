/**
 * Regression tests for live plan pricing (bug-037).
 *
 * Fixtures are the exact payloads the live catalogue returned on 2026-10-14,
 * captured through /api/admin/pricing-diagnostics. They are kept verbatim
 * because every defect in bug-037 came from assuming a shape the provider does
 * not actually use.
 *
 * Run with: npm run test:pricing
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

const BUILD = path.join(__dirname, '..', '.test-build');
const client = require(path.join(BUILD, 'api', 'client.js'));

// ---------------------------------------------------------------------------
// Fixtures: live catalogue, 2026-10-14
// ---------------------------------------------------------------------------

const CUSTOMER_PRICE = {
  // Shared hosting: plan ids at the TOP level, no `plans` wrapper.
  singledomainhostinglinuxus: {
    '5380078': {
      renew: { '12': 700, '24': 700, '36': 700 },
      ssl: 500,
      add: { '12': 350, '24': 350, '36': 350 },
    },
    '6305734': {
      renew: { '12': 400, '24': 400, '36': 400 },
      ssl: 500,
      add: { '12': 200, '24': 200, '36': 200 },
    },
    '7293195': {
      renew: { '12': 228, '24': 228, '36': 228, '120': 228 },
      add: { '12': 108, '24': 108, '36': 108, '120': 108 },
    },
  },
  // Acronis: the other confirmed shape, wrapped in `plans`.
  acronisbackupasia: {
    plans: { '1682': { add: { '1': 30, '3': 30, '6': 30, '12': 30, '24': 30, '36': 30 } } },
  },
};

const RESELLER_COST = {
  // Nested under the product key a SECOND time, keyed by band id.
  singledomainhostinglinuxus: {
    singledomainhostinglinuxus: {
      '87': { pricing: { renew: 335, ssl: 250, add: 160 }, description: { default: true, webspace: -1 } },
      '88': { pricing: { renew: 160, ssl: 250, add: 70 }, description: { webspace: 1024 } },
      '89': { pricing: { renew: 190, ssl: 250, add: 90 }, description: { webspace: 20480 } },
      '90': { pricing: { renew: 225, ssl: 250, add: 115 }, description: { webspace: 102400 } },
    },
  },
};

const PLAN_DETAILS = {
  singledomainhostinglinuxus: {
    singledomainhostinglinuxus: {
      '5380078': { plan_name: 'Advanced', status: 'Paused', bandid: '87', webspace: '-1', no_of_mail_accounts: '-1' },
      '6305734': { plan_name: 'Economy', status: 'Active', bandid: '89', webspace: '10240', no_of_mail_accounts: '5' },
      '7293195': { plan_name: 'Standard', status: 'Active', bandid: '89', webspace: '20480', no_of_mail_accounts: '10' },
    },
  },
  acronisbackupasia: {
    acronisbackupasia: { '1682': { plan_name: 'Acronis 50GB', status: 'Active', bandid: '12' } },
  },
};

client.isLiveApiConfigured = () => true;
client.apiClient = async (endpoint, params) => {
  if (endpoint.includes('customer-price')) return { success: true, data: CUSTOMER_PRICE };
  if (endpoint.includes('reseller-cost-price')) return { success: true, data: RESELLER_COST };
  if (endpoint.includes('plan-details')) {
    return { success: true, data: PLAN_DETAILS[params['product-key']] || {} };
  }
  return { success: false };
};

const hp = require(path.join(BUILD, 'api', 'hostingPricing.js'));

const INR = 83.5;
const usd = (inr) => Number((inr / INR).toFixed(2));

// ---------------------------------------------------------------------------
// Parser: the shapes the provider actually returns
// ---------------------------------------------------------------------------

test('parses plan ids held at the top level (shared hosting)', async () => {
  const r = await hp.getLiveHostingPricing();
  assert.ok(r.SHARED_LINUX, 'SHARED_LINUX should be priced');
  assert.deepStrictEqual(
    Object.keys(r.SHARED_LINUX).sort(),
    ['Advanced', 'Economy', 'Standard']
  );
});

test('parses plan ids wrapped in `plans` (acronis)', async () => {
  const r = await hp.getLiveHostingPricing();
  assert.ok(r.SECURITY_ACRONIS?.['Acronis 50GB'], 'acronis plan should be priced');
  assert.strictEqual(r.SECURITY_ACRONIS['Acronis 50GB'].monthlyUsd, usd(30));
});

test('joins cost through plan_details.bandid, not plan id', async () => {
  const r = await hp.getLiveHostingPricing();
  // Standard and Economy both sit on band 89 -> add 90.
  assert.strictEqual(r.SHARED_LINUX.Standard.wholesaleMonthlyUsd, usd(90));
  assert.strictEqual(r.SHARED_LINUX.Economy.wholesaleMonthlyUsd, usd(90));
  // Advanced is band 87 -> add 160.
  assert.strictEqual(r.SHARED_LINUX.Advanced.wholesaleMonthlyUsd, usd(160));
});

test('keeps the first-term price separate from the renewal price', async () => {
  const r = await hp.getLiveHostingPricing();
  const s = r.SHARED_LINUX.Standard;
  assert.strictEqual(s.annualMonthlyUsd, usd(108), 'first term');
  assert.strictEqual(s.renewMonthlyUsd, usd(228), 'renewal');
  assert.notStrictEqual(s.annualMonthlyUsd, s.renewMonthlyUsd);
});

test('records the shortest tenure upstream will sell', async () => {
  const r = await hp.getLiveHostingPricing();
  assert.strictEqual(r.SHARED_LINUX.Standard.minTenureMonths, 12);
  // No 1-month tenure exists for hosting, so no month-to-month rate is claimed.
  assert.strictEqual(r.SHARED_LINUX.Standard.monthlyUsd, undefined);
  assert.strictEqual(r.SECURITY_ACRONIS['Acronis 50GB'].minTenureMonths, 1);
});

test('carries the upstream status so paused plans can be withheld', async () => {
  const r = await hp.getLiveHostingPricing();
  assert.strictEqual(r.SHARED_LINUX.Advanced.status, 'Paused');
  assert.strictEqual(r.SHARED_LINUX.Economy.status, 'Active');
});

test('a plan with no readable name is skipped, never matched by position', async () => {
  const saved = PLAN_DETAILS.singledomainhostinglinuxus.singledomainhostinglinuxus['7293195'];
  delete PLAN_DETAILS.singledomainhostinglinuxus.singledomainhostinglinuxus['7293195'];
  hp.__resetForTests?.();
  try {
    const r = await hp.getLiveHostingPricing();
    assert.ok(!r.SHARED_LINUX.Standard, 'unnamed plan must not appear');
    assert.ok(r.SHARED_LINUX.Economy, 'named plans still appear');
  } finally {
    PLAN_DETAILS.singledomainhostinglinuxus.singledomainhostinglinuxus['7293195'] = saved;
    hp.__resetForTests?.();
  }
});

// ---------------------------------------------------------------------------
// Fulfilment: an order must not be accepted for something upstream won't deliver
// ---------------------------------------------------------------------------

test('getSellablePlan refuses a paused plan', async () => {
  assert.strictEqual(await hp.getSellablePlan('SHARED_LINUX', 'Advanced'), null);
});

test('getSellablePlan returns an active plan with its upstream id', async () => {
  const plan = await hp.getSellablePlan('SHARED_LINUX', 'Economy');
  assert.ok(plan);
  assert.strictEqual(plan.planId, '6305734');
  assert.strictEqual(plan.status, 'Active');
});

test('getSellablePlan refuses an unknown plan or family', async () => {
  assert.strictEqual(await hp.getSellablePlan('SHARED_LINUX', 'Nonexistent'), null);
  assert.strictEqual(await hp.getSellablePlan('NOT_A_FAMILY', 'Economy'), null);
});

// ---------------------------------------------------------------------------
// Advertised specifications must match what upstream provisions
// ---------------------------------------------------------------------------

test('advertised storage matches the mapped upstream plan', async () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'hosting', 'shared-linux', 'page.tsx'),
    'utf8'
  );

  // Split the published catalogue into one block per tier.
  const blocks = src.split(/\n\s*\{\s*\n\s*name:/).slice(1);
  assert.ok(blocks.length >= 3, 'expected at least three published tiers');

  const r = await hp.getLiveHostingPricing();
  const byName = r.SHARED_LINUX;
  let checked = 0;

  for (const block of blocks) {
    const upstream = block.match(/upstreamPlan:\s*'([^']+)'/)?.[1];
    if (!upstream) continue;

    const plan = byName[upstream];
    assert.ok(plan, `page maps to upstream plan "${upstream}" which is not in the catalogue`);

    const storage = block.match(/(\d+)\s*GB NVMe SSD/)?.[1];
    const unlimited = /Unlimited NVMe SSD/.test(block);

    if (unlimited) {
      assert.strictEqual(
        plan.webspaceMb,
        -1,
        `tier mapped to "${upstream}" advertises unlimited storage but upstream provisions ${plan.webspaceMb} MB`
      );
    } else if (storage) {
      assert.strictEqual(
        Number(storage) * 1024,
        plan.webspaceMb,
        `tier mapped to "${upstream}" advertises ${storage} GB but upstream provisions ${plan.webspaceMb} MB`
      );
    }
    checked++;
  }

  assert.strictEqual(checked, 3, 'all three tiers should declare an upstream plan');
});

// ---------------------------------------------------------------------------
// Regressions from the full-catalogue audit (19 families, 2026-10-15)
// ---------------------------------------------------------------------------

test('a candidate key that exists but carries no plans is skipped', async () => {
  // `eeliteus` is in the catalogue but empty; `enterpriseemailus` has the
  // plans. Stopping at the first key that merely exists left business email
  // unsellable.
  CUSTOMER_PRICE.eeliteus = {};
  CUSTOMER_PRICE.enterpriseemailus = {
    '900': { add: { '1': 150, '12': 120 }, renew: { '12': 150 } },
  };
  PLAN_DETAILS.enterpriseemailus = {
    enterpriseemailus: { '900': { plan_name: 'Business Email', status: 'Active' } },
  };
  hp.__resetForTests();
  try {
    const r = await hp.getLiveHostingPricing();
    assert.ok(r.EMAIL_BUSINESS, 'should fall through to the key that has plans');
    assert.ok(r.EMAIL_BUSINESS['Business Email']);
  } finally {
    delete CUSTOMER_PRICE.eeliteus;
    delete CUSTOMER_PRICE.enterpriseemailus;
    delete PLAN_DETAILS.enterpriseemailus;
    hp.__resetForTests();
  }
});

test('a plan with no reported status is still sellable', async () => {
  // Of nineteen families only shared Linux and Windows report a status at all.
  // Requiring "Active" withheld the other sixteen.
  CUSTOMER_PRICE.sitelock = { plans: { '178': { add: { '12': 170 } } } };
  PLAN_DETAILS.sitelock = { sitelock: { '178': { plan_name: 'Basic' } } };
  hp.__resetForTests();
  try {
    const plan = await hp.getSellablePlan('SECURITY_SITELOCK', 'Basic');
    assert.ok(plan, 'an unreported status must not block the sale');
    assert.strictEqual(plan.status, 'Unknown');
  } finally {
    delete CUSTOMER_PRICE.sitelock;
    delete PLAN_DETAILS.sitelock;
    hp.__resetForTests();
  }
});

test('a paused plan is still refused', async () => {
  assert.strictEqual(await hp.getSellablePlan('SHARED_LINUX', 'Advanced'), null);
});
