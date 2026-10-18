import { apiClient, isLiveApiConfigured, ApiResponse } from './client';
import { apiV2, isUnavailable } from './clientV2';
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
  autoRenew?: boolean;
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
    'auto-renew': params.autoRenew === false ? 'false' : 'true',
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
 * Whether a domain can be transferred in at all.
 *
 * The v2 specification pairs transfer-in with GET validate-transfer-in for
 * exactly this purpose: catching what a registry refuses outright - inside the
 * 60-day window after registration or a previous transfer, registrar-locked,
 * expired past the grace period, privacy still on at the losing registrar -
 * before the customer is charged rather than after.
 *
 * `transferable: null` means the check did not answer. That is deliberately not
 * a refusal: the authoritative answer comes from the transfer call itself, and
 * blocking an order on a check that is merely unavailable would be worse than
 * letting the transfer speak for itself.
 */
export async function validateTransfer(
  domainName: string
): Promise<{ transferable: boolean | null; reason?: string }> {
  if (!isLiveApiConfigured()) return { transferable: true };

  const res = await apiV2<{ success?: boolean; status?: string; message?: string }>(
    `/domains/${encodeURIComponent(domainName)}/validate-transfer-in`
  );

  if (res.success) {
    const body = res.data || {};
    if (body.success === true || body.status === 'Success') return { transferable: true };
    if (body.success === false) {
      return { transferable: false, reason: body.message || transferRefusalReason() };
    }
    return { transferable: null, reason: body.message || 'The check returned no verdict.' };
  }

  // A rejection that names a reason is a real answer; only an unreachable
  // endpoint is inconclusive.
  if (!isUnavailable(res)) {
    return { transferable: false, reason: res.error || transferRefusalReason() };
  }

  return { transferable: null, reason: res.error };
}

function transferRefusalReason(): string {
  return (
    'The registry will not accept a transfer for this domain yet. The usual causes are ' +
    'a registration or previous transfer less than 60 days old, a registrar lock, or ' +
    'privacy protection still enabled at the current registrar.'
  );
}

/** TLDs whose registry demands the authorisation code at order placement. */
const AUTH_CODE_REQUIRED_AT_PLACEMENT = ['.au', '.ca', '.de', '.eu', '.nz'];

/**
 * Transfer a domain in from another registrar.
 *
 * Field set and required-ness come from the v2 InitiateDomainTransferRequest
 * schema: customerId, the four contact ids, invoiceOption and autoRenew are
 * required; authCode, ns, privacy and premium DNS are optional. There is no
 * `years` parameter - a transfer carries the term the registry grants, not one
 * the caller chooses, which is why an earlier attempt to send one was wrong.
 *
 * Tries v2 first because that is the documented interface, and falls back to
 * the legacy endpoint only when v2 reports the account cannot reach it at all
 * (401/403/404). A validation or business rejection from v2 is a real answer
 * and is returned as-is - retrying that on legacy would risk lodging the same
 * transfer twice.
 */
export async function transferDomain(params: {
  domainName: string;
  customerId: string;
  authCode: string;
  contacts?: { registrant: string; admin: string; tech: string; billing: string };
  /** Required by the specification. Defaults to on, as a registrar normally would. */
  autoRenew?: boolean;
  nameservers?: string[];
  privacyProtection?: boolean;
}): Promise<ApiResponse> {
  const dot = params.domainName.indexOf('.');
  const tld = dot === -1 ? '' : params.domainName.slice(dot).toLowerCase();
  const authCode = params.authCode?.trim() || '';

  // The specification makes authCode optional for most TLDs, submittable
  // afterwards via submitTransferAuthCode. It is still required here: a
  // transfer lodged without one sits pending until the registry times it out,
  // and the customer has already paid by that point.
  if (!authCode) {
    const mandatory = AUTH_CODE_REQUIRED_AT_PLACEMENT.includes(tld);
    return {
      success: false,
      error: mandatory
        ? `A ${tld} transfer cannot be lodged without the authorisation code. Ask the customer for the EPP code from their current registrar, then retry.`
        : 'This transfer has no authorisation code. Ask the customer for the EPP code ' +
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

  if (!params.contacts?.registrant) {
    return {
      success: false,
      error:
        'No registrant contact was supplied, so this transfer cannot be lodged. ' +
        'Create one from the customer details first.',
    };
  }

  // Ask first. A refusal here costs one request; learning the same thing from
  // the transfer call costs the customer's money and an order that then has to
  // be unpicked by hand.
  const preflight = await validateTransfer(params.domainName);
  if (preflight.transferable === false) {
    return { success: false, error: preflight.reason };
  }

  const ns = params.nameservers || ['ns1.hostmattic.com', 'ns2.hostmattic.com'];
  const autoRenew = params.autoRenew !== false;

  const v2 = await apiV2(`/domains/${encodeURIComponent(params.domainName)}/transfer-in`, {
    method: 'POST',
    body: {
      authCode,
      customerId: Number(params.customerId),
      regContactId: Number(params.contacts.registrant),
      adminContactId: Number(params.contacts.admin),
      techContactId: Number(params.contacts.tech),
      billingContactId: Number(params.contacts.billing),
      invoiceOption: 'NoInvoice',
      autoRenew,
      purchasePrivacy: Boolean(params.privacyProtection),
      protectPrivacy: Boolean(params.privacyProtection),
      ns: ns.slice(0, 13),
    },
  });

  if (v2.success || !isUnavailable(v2)) {
    return { success: v2.success, data: v2.data, error: v2.error };
  }

  console.warn(
    `[transfer] v2 unavailable (HTTP ${v2.httpStatus}); falling back to the legacy endpoint.`
  );

  const postData: Record<string, any> = {
    'domain-name': params.domainName,
    'auth-code': authCode,
    'customer-id': params.customerId,
    'reg-contact-id': params.contacts.registrant,
    'admin-contact-id': params.contacts.admin,
    'tech-contact-id': params.contacts.tech,
    'billing-contact-id': params.contacts.billing,
    'invoice-option': 'NoInvoice',
    'auto-renew': autoRenew ? 'true' : 'false',
    'purchase-privacy': params.privacyProtection ? 'true' : 'false',
    'protect-privacy': params.privacyProtection ? 'true' : 'false',
    ns: ns.join(','),
  };

  return apiClient('/domains/transfer.json', postData, 'POST');
}

/**
 * Supplies the authorisation code for a transfer already lodged without one.
 * The specification's route for the TLDs where the code may follow the order.
 */
export async function submitTransferAuthCode(
  orderId: string,
  authCode: string
): Promise<ApiResponse> {
  if (!authCode?.trim()) {
    return { success: false, error: 'No authorisation code was supplied.' };
  }
  if (!isLiveApiConfigured()) return { success: true, isMock: true };

  const res = await apiV2(`/domains/${encodeURIComponent(orderId)}/transfer-in/auth-code`, {
    method: 'POST',
    body: { authCode: authCode.trim() },
  });
  return { success: res.success, data: res.data, error: res.error };
}

/**
 * Transfers lodged upstream and still in progress.
 *
 * Worth having because a transfer is not instant - it can sit for days waiting
 * on the losing registrar. Without this, a transfer that was lodged and one
 * that was never accepted look identical from here.
 */
export async function listPendingTransfers(
  filters: { customerId?: string; domainName?: string; orderId?: string } = {}
): Promise<ApiResponse> {
  if (!isLiveApiConfigured()) return { success: true, data: { transfers: [] }, isMock: true };

  const res = await apiV2('/domain-transfers/pending', {
    query: {
      size: 50,
      page: 1,
      customerId: filters.customerId ? Number(filters.customerId) : undefined,
      domainName: filters.domainName,
      orderId: filters.orderId ? Number(filters.orderId) : undefined,
    },
  });
  return { success: res.success, data: res.data, error: res.error };
}
