// scripts/audit-dashboards.js
//
// The layout audit for the two AUTHENTICATED consoles, which
// scripts/audit-layout.js cannot reach.
//
// Those pages are guarded by middleware and read from the database, so they
// cannot be rendered by simply fetching a URL. This script therefore:
//
//   1. mints a session cookie with the LOCAL JWT_SECRET, and
//   2. intercepts /api/client/services and /api/admin/overview, answering
//      with fixtures built to be awkward: a very long domain, a long customer
//      name and email, a domain with NO nameservers on record, and an order
//      number in the full HMO/2026-27/0001 form.
//
// It then opens every tab and probes for content that is clipped with no way
// to scroll to it, or that paints outside its parent box - the two faults
// that hid the portal's Manage button and the search results' prices.
//
// This runs against a LOCAL dev server only. It mints a token for a fixture
// user on localhost; it never touches production, and the fixtures never
// reach a database.
//
// Usage:
//   npm run dev
//   npm run audit:dashboards
//   npm run audit:dashboards -- http://localhost:3001

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { chromium } = require('@playwright/test');

const BASE = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)) {
  console.error('Refusing to run against a non-local host. This script mints its own session.');
  process.exit(1);
}

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadDotEnv();

const SECRET = process.env.JWT_SECRET;
if (!SECRET) {
  console.error('JWT_SECRET is not set locally, so no session can be minted.');
  process.exit(1);
}

// Deliberately awkward values: long names are what broke the layouts.
const LONG_DOMAIN = 'chaitanyaholidayhomes.in';
const LONGER_DOMAIN = 'international-conference-proceedings-2027.org';
const LONG_EMAIL = 'meghnath.chari.accounts.payable@averylongcompanyname.co.in';
const LONG_NAME = 'Chaitanya Holiday Homes & Resorts Private Limited';

const mkDomain = (name, ns) => ({
  id: 'dom_' + name, domainName: name, tld: name.split('.').slice(1).join('.'),
  status: 'ACTIVE', registrationDate: '2026-11-05T00:00:00.000Z',
  expiryDate: '2027-11-05T00:00:00.000Z', autoRenew: true, privacyEnabled: false,
  // null is the important case: it must read "Not on record", never a
  // hardcoded pair of hostnames.
  nameservers: ns, upstreamOrderId: '123456789',
});

const CLIENT_FIXTURE = {
  success: true,
  user: { id: 'usr_1', email: LONG_EMAIL, name: LONG_NAME, role: 'CUSTOMER' },
  domains: [mkDomain(LONG_DOMAIN, null), mkDomain(LONGER_DOMAIN, 'ns1.externalprovider.example.com,ns2.externalprovider.example.com')],
  hosting: [{
    id: 'hos_1', domainName: LONGER_DOMAIN, productType: 'SHARED_LINUX',
    planName: 'Business Cloud Hosting - Unlimited Websites', status: 'ACTIVE',
    billingCycle: 'ANNUAL', nextDueDate: '2027-11-05T00:00:00.000Z',
  }],
  addons: [],
  orders: [{
    id: 'ord_1', orderNumber: 'HMO/2026-27/0001', invoiceNumber: 'HM/2026-27/0001',
    status: 'COMPLETED', paymentStatus: 'PAID', totalAmount: 1730, currency: 'INR',
    createdAt: '2026-11-05T00:00:00.000Z',
    user: { id: 'usr_1', name: LONG_NAME, email: LONG_EMAIL },
    items: [{ id: 'it_1', description: 'Domain Registration - ' + LONG_DOMAIN, price: 1466.1, billingPeriod: '1 Year', provisionStatus: 'PROVISIONED', domainName: LONG_DOMAIN }],
  }],
  tickets: [],
  // Filled in below, once the real producer is loaded.
  expirations: null,
  // Empty on purpose: the "Reset to Hostmattic NS" control must NOT appear
  // when no branded nameserver resolves.
  brandNameservers: [],
};

// The financial report has a large nested shape, and guessing its field names
// is exactly the mistake the console itself has made three times (see the
// Analytics field names note in cerebrum). So build it with the REAL
// producer: a hand-written stand-in would crash the page, as it did here with
// "Cannot read properties of undefined (reading 'toFixed')", and that crash
// would have been mistaken for an application fault.
let computeFinancialReport, computeExpirationAnalytics;
try {
  ({ computeFinancialReport, computeExpirationAnalytics } = require('../.fixture-build/analytics/pnl.js'));
} catch {
  console.error(
    [
      'Compile the analytics module first, so the admin fixture matches the real shape:',
      '  npx tsc lib/analytics/pnl.ts --rootDir lib --outDir .fixture-build --module commonjs \\',
      '    --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop',
      '',
    ].join('\n')
  );
  process.exit(1);
}

const REPORT = computeFinancialReport(CLIENT_FIXTURE.orders, 'all');
CLIENT_FIXTURE.expirations = computeExpirationAnalytics(CLIENT_FIXTURE.domains, CLIENT_FIXTURE.hosting);
const EXPIRY = computeExpirationAnalytics(CLIENT_FIXTURE.domains, CLIENT_FIXTURE.hosting);

const ADMIN_FIXTURE = {
  success: true,
  metrics: {
    totalCustomers: 1, activeDomains: 2, activeHosting: 1, totalOrders: 1,
    activeAddons: 0, openTickets: 0,
    expirationsRequiringAttention: EXPIRY.totalRequiringAttention,
    expirationsCritical: EXPIRY.criticalCount,
    financials: REPORT,
    gatewayStatus: {
      mode: 'LIVE_PRODUCTION', upstreamConnected: true,
      // Exactly the shape the overview route emits: { currency, balance,
      // locked }. An invented shape here crashes the console on .toFixed and
      // reads like an application fault when it is only a bad fixture.
      resellerBalance: { currency: 'INR', balance: 1.34, locked: 0 },
      lastPing: '2026-11-05T00:00:00.000Z',
      targetEndpoint: 'https://httpapi.com/api',
      hasAuthUserId: true, hasApiKey: true,
    },
  },
  financials: { allTime: REPORT, last30d: REPORT, last7d: REPORT, mtd: REPORT },
  domains: CLIENT_FIXTURE.domains,
  hosting: CLIENT_FIXTURE.hosting,
  orders: CLIENT_FIXTURE.orders,
  addons: [],
  tickets: [],
  customers: [{ id: 'usr_1', name: LONG_NAME, email: LONG_EMAIL, phone: '+91 98765 43210', company: LONG_NAME, country: 'IN', createdAt: '2026-11-05T00:00:00.000Z', upstreamCustomerId: '35131127' }],
  expirations: EXPIRY,
};

// What the privacy tab renders from. Long strings on purpose: the shared-with
// text is the widest content in that panel.
const PRIVACY_FIXTURE = {
  success: true,
  noticeVersion: '2026-11-05.1',
  purposes: [
    { key: 'account', label: 'Running your account', data: 'Your name, email address and password (stored only as a one-way hash).', why: 'To create your account, sign you in, and show you the services you hold.', sharedWith: null, optional: false },
    { key: 'registrant', label: 'Registering a domain in your name', data: 'Your name, postal address, email address and phone number.', why: 'Domain registries require these from the registrant.', sharedWith: 'Our upstream registrar and the registry operating the extension. Some registries publish part of this in a public WHOIS record, and some operate outside India.', optional: false },
    { key: 'marketing', label: 'Offers and product news', data: 'Your email address.', why: 'To tell you about new services, pricing changes and promotions.', sharedWith: null, optional: true },
  ],
  consents: [
    { purpose: 'account', granted: true, noticeVersion: '2026-11-05.1', grantedAt: '2026-11-05T00:00:00.000Z', withdrawnAt: null },
    { purpose: 'registrant', granted: true, noticeVersion: '2026-11-05.1', grantedAt: '2026-11-05T00:00:00.000Z', withdrawnAt: null },
    { purpose: 'marketing', granted: false, noticeVersion: '2026-11-05.1', grantedAt: '2026-11-05T00:00:00.000Z', withdrawnAt: '2026-11-05T00:00:00.000Z' },
  ],
  requests: [
    { id: 'dr1', type: 'ERASURE', status: 'OPEN', requestedAt: '2026-11-05T00:00:00.000Z', resolution: null },
    { id: 'dr2', type: 'ACCESS', status: 'COMPLETED', requestedAt: '2026-10-01T00:00:00.000Z', resolution: 'A copy of all records held was sent on 3 October 2026.' },
  ],
};

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1180, height: 820 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];

const PROBE = () => {
  const out = { pageWide: 0, clipped: [], escapes: [] };
  const de = document.documentElement;
  out.pageWide = de.scrollWidth - de.clientWidth;

  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const txt = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 52);
    return txt ? `${s} :: "${txt}"` : s;
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const ox = cs.overflowX;
    if (ox !== 'hidden' && ox !== 'clip') continue;
    if (cs.textOverflow === 'ellipsis') continue;
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 2) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 10) continue;
    out.clipped.push({ sel: label(el), n: over });
  }

  for (const el of document.querySelectorAll('*')) {
    const parent = el.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed' || cs.position === 'absolute') continue;
    const pcs = getComputedStyle(parent);
    if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') continue;
    const r = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    if (r.width < 20 || r.height < 8 || pr.width < 20) continue;
    const spill = Math.round(r.right - (pr.right - (parseFloat(pcs.paddingRight) || 0)));
    if (spill > 2) {
      out.escapes.push({
        sel: label(el),
        n: spill,
        // Name the box that is actually constraining it, otherwise the
        // finding says what spilled but not out of what.
        via: `parent ${label(parent).slice(0, 56)} w=${Math.round(pr.width)} vs child w=${Math.round(r.width)}`,
      });
    }
  }

  out.clipped.sort((a, b) => b.n - a.n);
  out.escapes.sort((a, b) => b.n - a.n);
  out.clipped = out.clipped.slice(0, 5);
  out.escapes = out.escapes.slice(0, 5);
  return out;
};

const CONSOLES = [
  {
    name: 'client portal', url: '/client/dashboard',
    token: { id: 'usr_1', email: LONG_EMAIL, name: LONG_NAME, role: 'CUSTOMER' },
    api: '**/api/client/services**', fixture: CLIENT_FIXTURE,
    // The privacy tab fetches its own endpoint. Without this it renders its
    // loading state and the audit measures an empty panel.
    extraRoutes: [{ pattern: '**/api/client/privacy**', body: PRIVACY_FIXTURE }],
    tabs: ['Dashboard Overview', 'My Domains', 'Web Hosting', 'Security & Add-ons', 'Invoices & Billing', 'Support Desk', 'Privacy & Data'],
  },
  {
    name: 'admin console', url: '/admin/dashboard',
    token: { id: 'adm_1', email: 'admin@hostmattic.com', name: 'Administrator', role: 'ADMIN' },
    api: '**/api/admin/overview**', fixture: ADMIN_FIXTURE,
    tabs: ['Overview', 'Reports & P&L', 'Orders', 'Domains', 'Hosting', 'Security & Add-ons', 'Customers', 'Support Queue', 'Tax & GST Settings', 'Payment Gateways', 'API Gateway'],
  },
];

(async () => {
  const browser = await chromium.launch();
  const findings = [];

  for (const c of CONSOLES) {
    const token = jwt.sign(c.token, SECRET, { expiresIn: '1h' });

    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      await ctx.addCookies([{
        name: 'hm_auth_token', value: token,
        domain: new URL(BASE).hostname, path: '/', httpOnly: true, sameSite: 'Lax',
      }]);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => {
        const frame = String(e.stack || '').split('\n').find((l) => l.includes('/_next/') || l.includes('.tsx')) || '';
        findings.push({ where: `${c.name} (load)`, vp: vp.name, kind: 'jserror', detail: `${String(e.message).slice(0, 80)}  ${frame.trim().slice(0, 110)}` });
      });

      await page.route(c.api, (route) => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(c.fixture),
      }));
      for (const extra of c.extraRoutes || []) {
        await page.route(extra.pattern, (route) => route.fulfill({
          status: 200, contentType: 'application/json', body: JSON.stringify(extra.body),
        }));
      }
      // Everything else the console calls on mount: answer, do not hang.
      await page.route('**/api/admin/**', (route) => {
        if (route.request().url().includes('/overview')) return route.fallback();
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });

      try {
        await page.goto(BASE + c.url, { waitUntil: 'networkidle', timeout: 45000 });
        if (!page.url().includes(c.url)) {
          findings.push({ where: c.name, vp: vp.name, kind: 'redirect', detail: `bounced to ${page.url()}` });
          await ctx.close();
          continue;
        }
        await page.waitForTimeout(900);

        for (const tab of c.tabs) {
          try {
            // The label is preceded by an emoji span, so the accessible name
            // is "ICON Label". A ^-anchored match never fired, and every tab
            // silently re-probed Overview.
            const btn = page.getByRole('button', { name: new RegExp(tab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
            if (await btn.count()) {
              await btn.click({ timeout: 5000 });
              await page.waitForTimeout(600);
            } else {
              findings.push({ where: `${c.name} > ${tab}`, vp: vp.name, kind: 'notab', detail: 'tab control not found - this panel was never exercised' });
            }
          } catch { /* tab not clickable at this width; still probe what is shown */ }

          const r = await page.evaluate(PROBE);
          const where = `${c.name} > ${tab}`;
          if (r.pageWide > 2) findings.push({ where, vp: vp.name, kind: 'pagewide', detail: `${r.pageWide}px` });
          for (const x of r.clipped) findings.push({ where, vp: vp.name, kind: 'clipped', detail: `${x.n}px  ${x.sel}` });
          for (const x of r.escapes) findings.push({ where, vp: vp.name, kind: 'escapes', detail: `${x.n}px  ${x.sel}\n                        ${x.via}` });
        }
      } catch (e) {
        findings.push({ where: c.name, vp: vp.name, kind: 'error', detail: e.message.slice(0, 90) });
      }
      await ctx.close();
    }
  }

  await browser.close();

  if (!findings.length) {
    console.log('\nNo clipped or page-wide overflow in either console.\n');
    return;
  }
  console.log(`\n${findings.length} finding(s):\n`);
  const grouped = new Map();
  for (const f of findings) {
    if (!grouped.has(f.where)) grouped.set(f.where, []);
    grouped.get(f.where).push(f);
  }
  for (const [where, list] of grouped) {
    console.log(where);
    for (const f of list) console.log(`   [${f.vp.padEnd(7)}] ${f.kind.padEnd(8)} ${f.detail}`);
    console.log('');
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
