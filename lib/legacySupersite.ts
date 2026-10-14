/**
 * Legacy SuperSite 2 request handling.
 *
 * The upstream customer panel (hostmattic.myorderbox.com) still links out to
 * the old PHP storefront for every buy / transfer / renew flow, e.g.
 *
 *   /buy.php?r=customer&tid=<token>&p=domtransfer
 *   /reseller.php?action=validate_res_buy&tid=<token>&p=home
 *
 * Those paths no longer exist here, so each one dead-ends on a 404. Rather than
 * enumerate every product key the panel might emit - the key set is not
 * published and the old site is no longer crawlable - this matches on intent
 * and always lands somewhere useful.
 *
 * Edge-runtime safe: no Node APIs.
 */

/** Ordered most-specific first; the first substring hit wins. */
const PRODUCT_ROUTES: Array<[RegExp, string]> = [
  // Domains
  [/domtransfer|transfer/, '/domains/transfer'],
  [/newtld|gtld|sunrise|landrush/, '/domains/new-gtlds'],
  [/domreg|domain|whois|idn/, '/domains'],

  // Hosting - check the qualifiers before the generic word
  [/resellerhosting|reseller/, '/hosting/reseller'],
  [/wordpress|wphosting/, '/hosting/wordpress'],
  [/cloudhosting|cloud/, '/hosting/cloud'],
  [/windowshosting|winhosting|windows/, '/hosting/shared-windows'],
  [/multidomain|linuxhosting|webhosting|hosting/, '/hosting/shared-linux'],

  // Servers
  [/vps|virtualserver|kvm/, '/servers/vps'],
  [/dedicated|dedi|managedserver/, '/servers/dedicated'],

  // Email
  [/gapps|googleapps|gsuite|workspace/, '/email/google-workspace'],
  [/titan|bizmail|businessmail|enterprisemail|mail|email/, '/email/business'],

  // Security
  [/ssl|certificate|digicert|comodo|sectigo/, '/security/ssl'],
  [/sitelock|malware|sitesecurity|websitesecurity/, '/security/sitelock'],
  [/codeguard|xcitium|backup/, '/security/codeguard'],
  [/acronis/, '/security/acronis'],

  // Tools & bundles
  [/sitebuilder|websitebuilder|builder|weebly/, '/tools/website-builder'],
  [/combo|bundle/, '/bundles/combo-plans'],
];

/** Legacy filenames whose intent is clear without a product key. */
const FILE_ROUTES: Array<[RegExp, string]> = [
  [/^\/cart\.php$/, '/checkout'],
  [/^\/checkout\.php$/, '/checkout'],
  [/^\/login\.php$/, '/login'],
  [/^\/signup\.php$/, '/register'],
  [/^\/customer\.php$/, '/client/dashboard'],
  [/^\/myaccount\.php$/, '/client/dashboard'],
  [/^\/index\.php$/, '/'],
];

export function isLegacyPhp(pathname: string): boolean {
  return pathname.toLowerCase().endsWith('.php');
}

/**
 * True when the request is a transactional callback that only the upstream
 * platform can complete - a one-time token plus a validate/verify style action.
 * Browse intents ("I want to buy a domain") are NOT this, even though the panel
 * also puts a tid on them.
 */
export function isUpstreamCallback(pathname: string, params: URLSearchParams): boolean {
  const action = (params.get('action') || '').toLowerCase();
  if (!action) return false;
  if (!params.get('tid') && !params.get('token')) return false;
  return /validate|verify|confirm|activate|auth|callback|response/.test(action);
}

/**
 * Where a legacy URL should land in this app.
 * Always returns a real route - never null - so these never 404 again.
 */
export function resolveLegacyTarget(pathname: string, params: URLSearchParams): string {
  const path = pathname.toLowerCase();

  for (const [pattern, route] of FILE_ROUTES) {
    if (pattern.test(path)) return route;
  }

  // The panel carries intent in `p` (observed: p=domtransfer, p=home).
  // Fall back to other keys it is known to use, then to the filename itself.
  const hint = [
    params.get('p'),
    params.get('product'),
    params.get('productkey'),
    params.get('plan'),
    params.get('action'),
    path.replace(/^\/|\.php$/g, ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // p=home is the panel's "back to the storefront" link.
  if ((params.get('p') || '').toLowerCase() === 'home') return '/';

  for (const [pattern, route] of PRODUCT_ROUTES) {
    if (pattern.test(hint)) return route;
  }

  // Unknown intent: the catalogue is a better answer than a 404.
  return '/products';
}
