import { apiClient, isLiveApiConfigured, ApiResponse } from './client';
import { getLiveDomainPricing } from './pricing';

export interface DomainCheckResult {
  domain: string;
  tld: string;
  available: boolean;
  status: 'available' | 'taken' | 'unknown';
  rawStatus?: string;
  canTransfer?: boolean;
  priceUsd: number;
  priceInr: number;
  popular?: boolean;
  isSearchedExact?: boolean;
  isPromo?: boolean;
  badge?: string;
  promoEndsAt?: string;
}

const DEFAULT_TLD_PRICING: Record<string, { usd: number; inr: number; popular?: boolean; badge?: string }> = {
  '.com': { usd: 13.16, inr: 1099, popular: true },
  '.in': { usd: 9.33, inr: 779, popular: true },
  '.net': { usd: 15.07, inr: 1258 },
  '.org': { usd: 13.29, inr: 1110 },
  '.tech': { usd: 12.24, inr: 1022, popular: true },
  '.online': { usd: 8.81, inr: 736 },
  '.store': { usd: 10.53, inr: 879 },
  '.co': { usd: 23.17, inr: 1935 },
  '.io': { usd: 40.30, inr: 3365 },
  '.ai': { usd: 104.32, inr: 8711 },
  '.biz': { usd: 12.99, inr: 1085 },
  '.info': { usd: 5.13, inr: 428 },
  '.dev': { usd: 12.32, inr: 1029 },
  '.app': { usd: 14.78, inr: 1234 },
  '.shop': { usd: 1.70, inr: 142 },
  '.cloud': { usd: 20.86, inr: 1742 },
};

/**
 * Check availability of a domain name across multiple TLDs
 */
export async function checkDomainAvailability(
  domainQuery: string,
  tlds: string[] = ['.com', '.in', '.net', '.org', '.tech', '.online', '.store', '.io']
): Promise<DomainCheckResult[]> {
  const rawInput = domainQuery.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
  const queryParts = rawInput.split('.');
  const cleanName = queryParts[0].replace(/[^a-z0-9-]/g, '');

  if (!cleanName) return [];

  // If user searched a specific extension (e.g. ofinit.com or brand.tech)
  const requestedTld = queryParts.length > 1 ? `.${queryParts.slice(1).join('.')}` : null;

  // Ensure requested TLD is front and center
  let effectiveTlds = [...tlds];
  if (requestedTld && !effectiveTlds.includes(requestedTld)) {
    effectiveTlds = [requestedTld, ...effectiveTlds];
  } else if (requestedTld) {
    effectiveTlds = [requestedTld, ...effectiveTlds.filter((t) => t !== requestedTld)];
  }

  // Retrieve live pricing cache
  const livePrices = await getLiveDomainPricing().catch(() => ({}));

  if (!isLiveApiConfigured()) {
    // Realistic simulated check
    const knownTakenDomains = ['ofinit', 'hostmattic', 'google', 'apple', 'microsoft', 'amazon', 'facebook', 'twitter', 'github'];
    const isKnownTaken = knownTakenDomains.includes(cleanName) || cleanName.length <= 3;

    return effectiveTlds.map((tld) => {
      const pInfo = (livePrices as any)[tld];
      const fallback = DEFAULT_TLD_PRICING[tld] || { usd: 13.16, inr: 1099 };
      const priceUsd = pInfo?.retailUsd || fallback.usd;
      const priceInr = pInfo?.retailInr || fallback.inr;
      const isTaken = isKnownTaken && (tld === '.com' || tld === '.in');
      const status: 'available' | 'taken' | 'unknown' = isTaken ? 'taken' : 'available';

      return {
        domain: `${cleanName}${tld}`,
        tld,
        available: !isTaken,
        status,
        rawStatus: isTaken ? 'regthroughothers' : 'available',
        canTransfer: isTaken,
        priceUsd,
        priceInr,
        popular: Boolean(pInfo?.popular || fallback.popular),
        isSearchedExact: requestedTld ? tld === requestedTld : tld === '.com',
        isPromo: Boolean(pInfo?.isPromo),
        badge: pInfo?.badge || fallback.badge,
        promoEndsAt: pInfo?.promoEndsAt,
      };
    });
  }

  // Call upstream /api/domains/available.json
  const tldClean = effectiveTlds.map((t) => t.replace(/^\./, ''));
  const params: Record<string, any> = {
    'domain-name': cleanName,
    tlds: tldClean,
  };

  const res = await apiClient<Record<string, { status: string; classkey?: string }>>(
    '/domains/available.json',
    params,
    'GET'
  );

  if (!res.success || !res.data) {
    // Upstream failure: mark as unknown rather than falsely declaring available
    return effectiveTlds.map((tld) => {
      const pInfo = (livePrices as any)[tld];
      const fallback = DEFAULT_TLD_PRICING[tld] || { usd: 13.16, inr: 1099 };
      return {
        domain: `${cleanName}${tld}`,
        tld,
        available: false,
        status: 'unknown',
        rawStatus: 'error',
        canTransfer: false,
        priceUsd: pInfo?.retailUsd || fallback.usd,
        priceInr: pInfo?.retailInr || fallback.inr,
        popular: Boolean(pInfo?.popular || fallback.popular),
        isSearchedExact: requestedTld ? tld === requestedTld : tld === '.com',
        isPromo: Boolean(pInfo?.isPromo),
        badge: pInfo?.badge,
        promoEndsAt: pInfo?.promoEndsAt,
      };
    });
  }

  return effectiveTlds.map((tld) => {
    const full = `${cleanName}${tld}`;
    const result = res.data?.[full];
    const rawStatus = (result?.status || '').toLowerCase().trim();
    const available = rawStatus === 'available';
    const isTaken = rawStatus === 'regthroughothers' || rawStatus === 'regthroughus';
    const status: 'available' | 'taken' | 'unknown' = available ? 'available' : (isTaken ? 'taken' : 'unknown');
    const canTransfer = rawStatus === 'regthroughothers';

    const pInfo = (livePrices as any)[tld];
    const fallback = DEFAULT_TLD_PRICING[tld] || { usd: 13.16, inr: 1099 };
    const priceUsd = pInfo?.retailUsd || fallback.usd;
    const priceInr = pInfo?.retailInr || fallback.inr;

    return {
      domain: full,
      tld,
      available,
      status,
      rawStatus,
      canTransfer,
      priceUsd,
      priceInr,
      popular: Boolean(pInfo?.popular || fallback.popular),
      isSearchedExact: requestedTld ? tld === requestedTld : tld === '.com',
      isPromo: Boolean(pInfo?.isPromo),
      badge: pInfo?.badge,
      promoEndsAt: pInfo?.promoEndsAt,
    };
  });
}

/**
 * Register a domain through upstream API
 */
export async function registerDomain(params: {
  domainName: string;
  customerId: string;
  /** Registrant, admin, technical and billing contact ids. Required upstream. */
  contacts?: { registrant: string; admin: string; tech: string; billing: string };
  years?: number;
  nameservers?: string[];
  privacyProtection?: boolean;
}): Promise<ApiResponse> {
  if (!isLiveApiConfigured()) {
    return {
      success: true,
      data: {
        entityid: Math.floor(10000000 + Math.random() * 90000000),
        status: 'Success',
        description: `Domain registration for ${params.domainName} completed successfully.`,
      },
      isMock: true,
    };
  }

  const ns = params.nameservers || ['ns1.hostmattic.com', 'ns2.hostmattic.com'];

  // The registry requires all four. Omitting them is what produced
  // "Required parameter missing: reg-contact-id" on the first real order.
  if (!params.contacts?.registrant) {
    return {
      success: false,
      error:
        'No registrant contact was supplied, so this domain cannot be registered. ' +
        'Create one from the customer details first.',
    };
  }

  const postData: Record<string, any> = {
    'domain-name': params.domainName,
    years: params.years || 1,
    'customer-id': params.customerId,
    'reg-contact-id': params.contacts.registrant,
    'admin-contact-id': params.contacts.admin,
    'tech-contact-id': params.contacts.tech,
    'billing-contact-id': params.contacts.billing,
    'invoice-option': 'NoInvoice',
    'protect-privacy': params.privacyProtection ? 'true' : 'false',
  };

  ns.forEach((s) => {
    postData['ns'] = ns.join(',');
  });

  return apiClient('/domains/register.json', postData, 'POST');
}

/**
 * Transfer a domain in from another registrar.
 *
 * Distinct from registration: upstream charges a different price for it and
 * requires the EPP / authorisation code the customer obtains from their
 * current registrar. Without that code the registry will reject the request,
 * so this refuses rather than sending one it knows will fail.
 */
export async function transferDomain(params: {
  domainName: string;
  customerId: string;
  authCode: string;
  contacts?: { registrant: string; admin: string; tech: string; billing: string };
  years?: number;
  nameservers?: string[];
  privacyProtection?: boolean;
}): Promise<ApiResponse> {
  if (!params.authCode?.trim()) {
    return {
      success: false,
      error:
        'This transfer has no authorisation code. Ask the customer for the EPP code ' +
        'from their current registrar, then retry.',
    };
  }

  if (!isLiveApiConfigured()) {
    return {
      success: true,
      data: {
        entityid: Math.floor(10000000 + Math.random() * 90000000),
        status: 'Success',
        description: `Domain transfer for ${params.domainName} initiated successfully.`,
      },
      isMock: true,
    };
  }

  const ns = params.nameservers || ['ns1.hostmattic.com', 'ns2.hostmattic.com'];

  if (!params.contacts?.registrant) {
    return {
      success: false,
      error:
        'No registrant contact was supplied, so this transfer cannot be lodged. ' +
        'Create one from the customer details first.',
    };
  }

  const postData: Record<string, any> = {
    'domain-name': params.domainName,
    'auth-code': params.authCode.trim(),
    'customer-id': params.customerId,
    'reg-contact-id': params.contacts.registrant,
    'admin-contact-id': params.contacts.admin,
    'tech-contact-id': params.contacts.tech,
    'billing-contact-id': params.contacts.billing,
    'invoice-option': 'NoInvoice',
    'protect-privacy': params.privacyProtection ? 'true' : 'false',
    ns: ns.join(','),
  };

  return apiClient('/domains/transfer.json', postData, 'POST');
}
