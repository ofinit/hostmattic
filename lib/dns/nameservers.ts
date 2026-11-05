/**
 * The branded nameservers, and whether they can actually be used.
 *
 * A registry validates the nameservers on a registration. Sending one that
 * does not resolve fails the order - after the customer has paid - which is
 * exactly how chaitanyaholidayhomes.in failed: ns1.hostmattic.com and
 * ns2.hostmattic.com were asserted in code while the hostmattic.com zone
 * published no A records for them. Glue at the .com registry lets a resolver
 * reach the zone; it does not make the name itself resolvable.
 *
 * So the names are configuration, not a constant, and they are checked before
 * use. Set them and they are used as soon as they genuinely resolve, with no
 * deploy. Until then the registration simply omits nameservers and upstream
 * applies the customer's default, which works.
 *
 * This fails OPEN: if the check itself cannot run, no nameservers are sent.
 * An order on upstream defaults is recoverable - the registrant can repoint
 * the domain - whereas an order rejected on a nameserver it could not verify
 * is money taken for nothing.
 */

import { promises as dns } from 'node:dns';

export interface NameserverCheck {
  host: string;
  ok: boolean;
  addresses?: string[];
  error?: string;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const LOOKUP_TIMEOUT_MS = 3000;

let cache: { at: number; usable: string[]; checks: NameserverCheck[] } | null = null;

/** Configured as a comma-separated list, e.g. "ns1.hostmattic.com,ns2.hostmattic.com". */
export function configuredNameservers(): string[] {
  return (process.env.BRAND_NAMESERVERS || '')
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 13);
}

async function resolvesToAnAddress(host: string): Promise<NameserverCheck> {
  const timeout = new Promise<NameserverCheck>((resolve) =>
    setTimeout(() => resolve({ host, ok: false, error: 'Lookup timed out.' }), LOOKUP_TIMEOUT_MS)
  );

  const lookup = (async (): Promise<NameserverCheck> => {
    // A record first; a nameserver reachable only over IPv6 is still valid, so
    // AAAA counts too.
    try {
      const addresses = await dns.resolve4(host);
      if (addresses.length) return { host, ok: true, addresses };
    } catch {
      /* fall through to AAAA */
    }
    try {
      const addresses = await dns.resolve6(host);
      if (addresses.length) return { host, ok: true, addresses };
    } catch (err: any) {
      return { host, ok: false, error: err?.code || 'No address record.' };
    }
    return { host, ok: false, error: 'No address record.' };
  })();

  return Promise.race([lookup, timeout]);
}

/** Every configured nameserver, with whether it resolves. Always runs the checks. */
export async function checkNameservers(): Promise<NameserverCheck[]> {
  const hosts = configuredNameservers();
  if (!hosts.length) return [];
  return Promise.all(hosts.map(resolvesToAnAddress));
}

/**
 * The nameservers safe to send upstream: the configured ones that resolve.
 *
 * Returns an empty list when none are configured, none resolve, or the check
 * could not run - and the caller then omits nameservers entirely.
 */
export async function usableNameservers(): Promise<string[]> {
  const hosts = configuredNameservers();
  if (!hosts.length) return [];

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.usable;

  try {
    const checks = await checkNameservers();
    const usable = checks.filter((c) => c.ok).map((c) => c.host);

    // All or nothing. A domain pointed at one working nameserver out of four
    // has no redundancy, and most registries want at least two.
    const result = usable.length >= 2 ? usable : [];

    if (usable.length && usable.length < hosts.length) {
      console.warn(
        `[dns] ${hosts.length - usable.length} of ${hosts.length} branded nameservers do not resolve: ` +
          checks.filter((c) => !c.ok).map((c) => c.host).join(', ')
      );
    }

    cache = { at: Date.now(), usable: result, checks };
    return result;
  } catch (err: any) {
    console.warn('[dns] Could not verify the branded nameservers:', err?.message);
    return [];
  }
}

/** Diagnostics want the detail, not just the usable list. */
export async function nameserverReport(): Promise<{
  configured: string[];
  checks: NameserverCheck[];
  usable: string[];
  verdict: string;
}> {
  const configured = configuredNameservers();
  if (!configured.length) {
    return {
      configured,
      checks: [],
      usable: [],
      verdict:
        'BRAND_NAMESERVERS is not set, so orders fall back to the customer default held ' +
        'upstream. See customerDefaultNameservers and wouldSend below for what an order would ' +
        'actually carry - nameservers are mandatory on a registration, so an empty wouldSend ' +
        'means the order cannot complete.',
    };
  }

  const checks = await checkNameservers();
  const ok = checks.filter((c) => c.ok).map((c) => c.host);
  const bad = checks.filter((c) => !c.ok);

  let verdict: string;
  if (!bad.length) {
    verdict = `All ${ok.length} branded nameservers resolve and are being sent on new orders.`;
  } else if (ok.length >= 2) {
    verdict =
      `${ok.length} of ${checks.length} resolve, which is enough to use, but ` +
      `${bad.map((b) => b.host).join(', ')} still publish no address record. Fix those so every ` +
      `nameserver in the delegation is reachable.`;
  } else {
    verdict =
      `Only ${ok.length} of ${checks.length} resolve, so NONE are being sent - orders fall back to ` +
      `the upstream default. Publish A records for ${bad.map((b) => b.host).join(', ')} in the ` +
      `zone, matching the glue already registered at the parent registry.`;
  }

  return { configured, checks, usable: ok.length >= 2 ? ok : [], verdict };
}

/** Testing seam. */
export function __resetNameserverCache(): void {
  cache = null;
}
