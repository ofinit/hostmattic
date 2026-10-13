/**
 * Legacy SuperSite 2 URL map.
 *
 * hostmattic.com used to serve a PHP storefront (SuperSite 2). When the domain
 * moved to this Next.js app every one of those URLs started returning 404 -
 * including the ones search engines had indexed and anything linking in from
 * outside. These redirects point each old path at its closest current page.
 *
 * All are permanent (308), so ranking signals transfer.
 *
 * Captured from a crawl of the live legacy site; see .wolf/memory.md.
 */

/** old path -> current path */
const MAP = {
  // --- Home ---------------------------------------------------------------
  '/index.php': '/',

  // --- Domains ------------------------------------------------------------
  '/domain-registration/index.php': '/domains',
  '/domain-registration/domain-registration-price.php': '/domains',
  '/domain-registration/domain-name-suggestion-tool.php': '/domains',
  '/domain-registration/bulk-domain-registration.php': '/domains',
  '/domain-registration/domain-whois-lookup.php': '/domains',
  '/domain-registration/free-with-domain-registration.php': '/domains',
  '/domain-registration/premium-domain.php': '/domains',
  '/domain-registration/promos.php': '/domains',
  '/domain-registration/idn': '/domains',
  '/domain-registration/transfer/index.php': '/domains/transfer',
  '/domain-registration/transfer/bulk-domain-transfer.php': '/domains/transfer',
  '/new-domain-extensions': '/domains/new-gtlds',
  '/new-domain-extensions/sunrise': '/domains/new-gtlds',

  // --- Shared & managed hosting -------------------------------------------
  '/web-hosting/index.php': '/hosting/shared-linux',
  '/web-hosting/linux-php-hosting.php': '/hosting/shared-linux',
  '/web-hosting/windows-hosting.php': '/hosting/shared-windows',
  '/web-hosting/datacenter-network.php': '/hosting/shared-linux',
  '/cloudhosting.php': '/hosting/cloud',
  '/optimized-wordpress-hosting.php': '/hosting/wordpress',
  '/reseller-hosting.php': '/hosting/reseller',
  '/windows-reseller-hosting.php': '/hosting/reseller',

  // --- Servers ------------------------------------------------------------
  '/virtualserverlinux-hosting.php': '/servers/vps',
  '/web-hosting/server-monitoring.php': '/servers/vps',
  '/dedicated-servers.php': '/servers/dedicated',
  '/dedicated-servers-windows.php': '/servers/dedicated',

  // --- Email --------------------------------------------------------------
  '/business-email': '/email/business',
  '/titan-business-email-hosting': '/email/business',
  '/web-hosting/enterprise-email-hosting.php': '/email/business',
  '/google_apps.php': '/email/google-workspace',

  // --- Security & backup --------------------------------------------------
  '/digital-certificate': '/security/ssl',
  '/website-security.php': '/security/sitelock',
  '/web-hosting/hosting-security.php': '/security/sitelock',
  '/acronis-backup': '/security/acronis',
  '/xcitiumbackup': '/security/codeguard',
  '/web-hosting/data-protection-recovery.php': '/security/codeguard',

  // --- Tools & bundles ----------------------------------------------------
  '/website-design/do-it-yourself-website-builder.php': '/tools/website-builder',
  '/combo-offers': '/bundles/combo-plans',

  // --- Account ------------------------------------------------------------
  '/login.php': '/login',
  '/checkout.php': '/checkout',

  // --- No current equivalent ----------------------------------------------
  // This site has no contact, legal or privacy page yet. Sending these to the
  // home page is a stopgap: search engines treat an unrelated redirect as a
  // soft 404, and a business taking payments is normally expected to publish
  // privacy and terms. Point these at real pages once they exist.
  '/support/contact-us.php': '/',
  '/support/legal.php': '/',
  '/support/privacy.php': '/',
};

/**
 * Transactional SuperSite callbacks (reseller.php?action=…&tid=…) cannot be
 * served by this app at all - they need the upstream platform. Set
 * LEGACY_SUPERSITE_ORIGIN to forward them with their query string intact.
 *
 * The branded upstream panel is https://hostmattic.myorderbox.com - the same
 * origin lib/api/customers.ts already uses for customer SSO (AutoLoginServlet),
 * so it is the right value here. It sits behind a bot challenge, so it cannot
 * be probed from a script; confirm the path in a browser before switching this
 * on.
 *
 * Left unset, token-bearing requests keep returning 404, which is safer than
 * silently sending someone holding a one-time token to a marketing page.
 */
function supersiteRedirects() {
  const origin = (process.env.LEGACY_SUPERSITE_ORIGIN || '').trim().replace(/\/$/, '');
  if (!origin) {
    // No upstream configured: the informational view still has a home here.
    return [
      {
        source: '/reseller.php',
        missing: [{ type: 'query', key: 'tid' }],
        destination: '/hosting/reseller',
        permanent: true,
      },
    ];
  }

  return [
    // Token-bearing callbacks go upstream, query preserved.
    {
      source: '/reseller.php',
      has: [{ type: 'query', key: 'tid' }],
      destination: `${origin}/reseller.php`,
      permanent: false, // transactional, never cache
    },
    {
      source: '/reseller.php',
      missing: [{ type: 'query', key: 'tid' }],
      destination: '/hosting/reseller',
      permanent: true,
    },
  ];
}

export function legacyRedirects() {
  const fromMap = Object.entries(MAP).map(([source, destination]) => ({
    source,
    destination,
    permanent: true,
  }));

  return [...fromMap, ...supersiteRedirects()];
}

export const LEGACY_PATHS = Object.keys(MAP);
