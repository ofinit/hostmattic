/**
 * The one USD -> INR rate.
 *
 * The literal 83.5 was written out in eight separate files - pricing,
 * hosting pricing, cart pricing, the P&L, the checkout page, the checkout
 * drawer and the currency context. Duplicated constants drift, and this set
 * already had: the billing list once used 84, and a customer who paid
 * Rs884.80 was shown a bill for Rs74,323.
 *
 * A stale rate is not neutral either. USD retail prices are derived from INR
 * by dividing by this number, so if the rupee strengthens and this does not
 * follow, every USD sale collects fewer rupees than intended - potentially
 * below wholesale.
 *
 * Resolution order, highest first:
 *
 *   1. A live rate, but ONLY when FX_RATE_API_URL is configured and the
 *      answer is plausible. Opt-in on purpose: adding a network call to the
 *      pricing path by default would let an outage at a third party change
 *      what a customer is quoted.
 *   2. USD_INR_RATE from the environment, so the rate can be corrected
 *      without a deploy.
 *   3. FALLBACK_USD_INR_RATE, which is what every one of those eight
 *      literals said.
 *
 * With nothing configured this returns exactly 83.5, so behaviour is
 * unchanged until someone chooses to change it.
 *
 * This is a QUOTING and reporting rate. It is not the rate a payment gateway
 * settles at, and it must never be used to restate an order that has already
 * been paid: those amounts are stored in the currency they were charged in
 * and are what the invoice says.
 */

/** What the eight hardcoded copies all said. */
export const FALLBACK_USD_INR_RATE = 83.5;

/**
 * A rate outside this band is refused rather than used.
 *
 * An FX endpoint that changes shape, rate-limits, or returns an error object
 * can easily yield 0, 1 or NaN. Any of those would silently reprice the
 * entire catalogue - 1.0 would sell a Rs1,085 domain for $1,085, and 0 would
 * make everything free. Refusing an implausible number and falling back is
 * the only safe response.
 */
const MIN_PLAUSIBLE_RATE = 50;
const MAX_PLAUSIBLE_RATE = 150;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

export type FxSource = 'live' | 'configured' | 'fallback';

export interface FxRateDetail {
  rate: number;
  source: FxSource;
  /** When the live rate was fetched; null when the rate did not come from one. */
  fetchedAt: string | null;
  /** True when a live rate was configured but the cached one has aged out. */
  stale: boolean;
}

let liveCache: { rate: number; at: number } | null = null;

function plausible(value: unknown): number | null {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  if (n < MIN_PLAUSIBLE_RATE || n > MAX_PLAUSIBLE_RATE) return null;
  return n;
}

/** The rate set in the environment, if it is a usable number. */
export function configuredUsdInrRate(): number | null {
  // Guarded: in a browser bundle process.env may not exist at all.
  const raw = typeof process !== 'undefined' ? process.env?.USD_INR_RATE : undefined;
  if (!raw) return null;
  const n = plausible(raw);
  if (n === null) {
    console.warn(
      `[fx] USD_INR_RATE is "${raw}", which is not a plausible rate ` +
        `(${MIN_PLAUSIBLE_RATE}-${MAX_PLAUSIBLE_RATE}). Ignoring it.`
    );
    return null;
  }
  return n;
}

/**
 * The rate to use right now, synchronously.
 *
 * Pricing and analytics are synchronous, so this never awaits. A live rate is
 * used only if refreshUsdInrRate() has already cached one.
 */
export function usdInrRate(): number {
  if (liveCache && Date.now() - liveCache.at < CACHE_TTL_MS) return liveCache.rate;
  return configuredUsdInrRate() ?? FALLBACK_USD_INR_RATE;
}

/** The rate plus where it came from, for diagnostics and the admin console. */
export function usdInrRateDetail(): FxRateDetail {
  const configured = configuredUsdInrRate();

  if (liveCache) {
    const age = Date.now() - liveCache.at;
    if (age < CACHE_TTL_MS) {
      return { rate: liveCache.rate, source: 'live', fetchedAt: new Date(liveCache.at).toISOString(), stale: false };
    }
    return {
      rate: configured ?? FALLBACK_USD_INR_RATE,
      source: configured !== null ? 'configured' : 'fallback',
      fetchedAt: new Date(liveCache.at).toISOString(),
      stale: true,
    };
  }

  return {
    rate: configured ?? FALLBACK_USD_INR_RATE,
    source: configured !== null ? 'configured' : 'fallback',
    fetchedAt: null,
    stale: false,
  };
}

/** Pulls INR out of the shapes the common free FX endpoints return. */
export function extractInrRate(payload: any): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidates = [
    payload.rates?.INR,
    payload.conversion_rates?.INR,
    payload.data?.INR,
    payload.INR,
    payload.rate,
  ];
  for (const c of candidates) {
    const n = plausible(c);
    if (n !== null) return n;
  }
  return null;
}

/**
 * Fetches a live rate, if one is configured.
 *
 * Never throws and never leaves a bad value in the cache: an unreachable
 * endpoint, a changed response shape or an implausible number all leave the
 * previous resolution in place. Call it from a background path, not from
 * checkout.
 */
export async function refreshUsdInrRate(): Promise<FxRateDetail> {
  const url = typeof process !== 'undefined' ? process.env?.FX_RATE_API_URL : undefined;
  if (!url) return usdInrRateDetail();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[fx] Rate endpoint answered HTTP ${res.status}; keeping the previous rate.`);
      return usdInrRateDetail();
    }

    const rate = extractInrRate(await res.json());
    if (rate === null) {
      console.warn('[fx] Rate endpoint returned no plausible INR rate; keeping the previous rate.');
      return usdInrRateDetail();
    }

    liveCache = { rate, at: Date.now() };
    return usdInrRateDetail();
  } catch (err: any) {
    console.warn('[fx] Could not refresh the rate:', err?.message);
    return usdInrRateDetail();
  }
}

/** Testing seam. */
export function __resetFxCache(): void {
  liveCache = null;
}
