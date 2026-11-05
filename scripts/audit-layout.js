// scripts/audit-layout.js
//
// Finds content the layout has made UNREACHABLE or UNREADABLE, across every
// public route at four viewports.
//
// Two distinct faults, both of which shipped to production:
//
//   clipped  - an element is wider than its box AND its computed overflow-x
//              is hidden or clip, so there is no way to scroll to the rest.
//              This is how the portal domain table lost its Actions column.
//
//   escapes  - an element paints outside its parent box. A card with the
//              default overflow: visible does not clip, so the check above
//              misses it entirely - yet a price painted past the edge of its
//              card is just as unreadable. This is how the domain search
//              results hid their prices (bug-051).
//
// Both come from the same root: a flex or grid item defaults to
// min-width: auto and refuses to shrink below its content.
//
// The live registry check is IP-whitelisted to the server, so the search is
// mocked with a deliberately long label and long prices - the input that
// broke the layout in the first place.
//
// Authenticated routes (/client/dashboard, /admin/dashboard) are NOT covered:
// they need a session and a reachable database. Audit those by hand.
//
// Usage:
//   npm run audit:layout                      against production
//   npm run audit:layout -- http://localhost:3000

const { chromium } = require('@playwright/test');

const BASE = (process.argv[2] || 'https://hostmattic.com').replace(/\/+$/, '');

const ROUTES = [
  '/', '/domains', '/domains/new-gtlds', '/domains/transfer', '/products',
  '/bundles/combo-plans', '/hosting/shared-linux', '/hosting/shared-windows',
  '/hosting/wordpress', '/hosting/cloud', '/hosting/reseller',
  '/servers/vps', '/servers/dedicated', '/email/business',
  '/email/google-workspace', '/security/ssl', '/security/sitelock',
  '/security/codeguard', '/security/acronis', '/tools/website-builder',
  '/login', '/register', '/checkout', '/admin/login',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1180, height: 820 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
];

const PROBE = () => {
  const out = { pageWide: 0, clipped: [] };
  const de = document.documentElement;
  out.pageWide = de.scrollWidth - de.clientWidth;

  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    const txt = (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    return txt ? `${s} :: "${txt}"` : s;
  };

  for (const el of document.querySelectorAll('*')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const ox = cs.overflowX;
    // Only hidden/clip traps content. auto/scroll is reachable.
    if (ox !== 'hidden' && ox !== 'clip') continue;
    const over = el.scrollWidth - el.clientWidth;
    if (over <= 2) continue;
    // Ignore deliberate ellipsis truncation: that is a design choice, and the
    // full value is still exposed via title.
    if (cs.textOverflow === 'ellipsis') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 10) continue;
    out.clipped.push({ sel: label(el), over });
  }

  // Content that ESCAPES its parent box. A card with default `overflow:
  // visible` does not clip, so the probe above misses it entirely - yet the
  // price painted outside its card is just as unreadable. This is the fault
  // seen on the domain search results.
  out.escapes = [];
  for (const el of document.querySelectorAll('*')) {
    const parent = el.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (cs.position === 'fixed' || cs.position === 'absolute') continue;
    const pcs = getComputedStyle(parent);
    // A scrollable parent is allowed to hold wider content.
    if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') continue;
    const r = el.getBoundingClientRect();
    const pr = parent.getBoundingClientRect();
    if (r.width < 20 || r.height < 8 || pr.width < 20) continue;
    const padR = parseFloat(pcs.paddingRight) || 0;
    const spill = Math.round(r.right - (pr.right - padR));
    if (spill > 2) out.escapes.push({ sel: label(el), spill });
  }
  out.escapes.sort((a, b) => b.spill - a.spill);
  out.escapes = out.escapes.slice(0, 6);
  // Deepest offenders only: a clipped child reported with its clipped parent
  // is one fault, not two.
  out.clipped.sort((a, b) => b.over - a.over);
  out.clipped = out.clipped.slice(0, 6);
  return out;
};

(async () => {
  const browser = await chromium.launch();
  const findings = [];

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    page.on('pageerror', () => {});

    // The live registry check is IP-whitelisted to the server, so locally it
    // never answers. Mock it with the exact shape the component consumes,
    // using a long label and long prices - which is what broke the layout.
    await page.route('**/api/domains/check**', async (route) => {
      const base = 'chaitanyaholidayhomes';
      const mk = (tld, price, extra) => Object.assign({
        domain: `${base}.${tld}`, tld: `.${tld}`, available: true,
        priceUsd: price, priceInr: Math.round(price * 83.5),
      }, extra || {});
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, results: [
          mk('com', 0, { available: false, isSearchedExact: true }),
          mk('in', 20.72, { popular: true }),
          mk('net', 38.08),
          mk('org', 13.43, { isPromo: true, badge: '65% OFF', promoEndsAt: '2027-04-01' }),
          mk('tech', 12.24, { isPromo: true, badge: '93% OFF', promoEndsAt: '2027-01-01' }),
          mk('online', 8.81, { isPromo: true, badge: '91% OFF', promoEndsAt: '2027-01-01' }),
          mk('store', 10.53, { isPromo: true, badge: '93% OFF', promoEndsAt: '2027-01-01' }),
          mk('io', 40.30, { isPromo: true, badge: '76% OFF', promoEndsAt: '2027-01-01' }),
        ] }),
      });
    });

    for (const route of ROUTES) {
      try {
        const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
        if (!res || res.status() >= 400) {
          findings.push({ route, vp: vp.name, kind: 'http', detail: `HTTP ${res ? res.status() : '?'}` });
          continue;
        }
        await page.waitForTimeout(400);
        const r = await page.evaluate(PROBE);
        if (r.pageWide > 2) {
          findings.push({ route, vp: vp.name, kind: 'pagewide', detail: `${r.pageWide}px` });
        }
        for (const c of r.clipped) {
          findings.push({ route, vp: vp.name, kind: 'clipped', detail: `${c.over}px  ${c.sel}` });
        }
        for (const c of r.escapes || []) {
          findings.push({ route, vp: vp.name, kind: 'escapes', detail: `${c.spill}px  ${c.sel}` });
        }

        // The search results are the densest layout in the app and only exist
        // after a query. A long label is what broke them, so use one.
        if (route === '/' || route === '/domains') {
          try {
            const box = page.locator('input[type="text"], input[type="search"]').first();
            await box.fill('chaitanyaholidayhomes');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1500);
            const r2 = await page.evaluate(PROBE);
            if (r2.pageWide > 2) {
              findings.push({ route: route + ' [searched]', vp: vp.name, kind: 'pagewide', detail: `${r2.pageWide}px` });
            }
            for (const c of r2.clipped) {
              findings.push({ route: route + ' [searched]', vp: vp.name, kind: 'clipped', detail: `${c.over}px  ${c.sel}` });
            }
            for (const c of r2.escapes || []) {
              findings.push({ route: route + ' [searched]', vp: vp.name, kind: 'escapes', detail: `${c.spill}px  ${c.sel}` });
            }
          } catch (e) {
            findings.push({ route: route + ' [searched]', vp: vp.name, kind: 'error', detail: e.message.slice(0, 80) });
          }
        }
      } catch (e) {
        findings.push({ route, vp: vp.name, kind: 'error', detail: e.message.slice(0, 90) });
      }
    }
    await ctx.close();
  }

  await browser.close();

  if (!findings.length) {
    console.log('\nNo clipped or page-wide overflow found.\n');
    return;
  }
  console.log(`\n${findings.length} finding(s):\n`);
  const byRoute = new Map();
  for (const f of findings) {
    if (!byRoute.has(f.route)) byRoute.set(f.route, []);
    byRoute.get(f.route).push(f);
  }
  for (const [route, list] of byRoute) {
    console.log(`${route}`);
    for (const f of list) console.log(`   [${f.vp.padEnd(7)}] ${f.kind.padEnd(8)} ${f.detail}`);
    console.log('');
  }
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
