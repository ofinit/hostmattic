import { NextResponse } from 'next/server';
import { usdInrRateDetail, refreshUsdInrRate } from '@/lib/pricing/fx';

export const dynamic = 'force-dynamic';

/**
 * The USD -> INR rate the server is using.
 *
 * Browser code cannot read USD_INR_RATE, so without this the client would go
 * on carrying its own copy of the number - which is exactly how the billing
 * list ended up using 84 while everything else used 83.5, and billed Rs74,323
 * for a Rs884.80 payment.
 *
 * Public, because the marketing pages price in both currencies before anyone
 * signs in. It exposes a published shop rate and nothing else.
 */
export async function GET() {
  // Only attempts a network call when FX_RATE_API_URL is set, and never
  // throws: a failure leaves the previous resolution in place.
  const detail = await refreshUsdInrRate().catch(() => usdInrRateDetail());

  return NextResponse.json(
    {
      success: true,
      pair: 'USDINR',
      rate: detail.rate,
      source: detail.source,
      fetchedAt: detail.fetchedAt,
      stale: detail.stale,
    },
    {
      // Worth caching: the rate moves slowly and every page asks for it.
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' },
    }
  );
}
