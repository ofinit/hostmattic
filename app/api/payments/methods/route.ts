import { NextRequest, NextResponse } from 'next/server';
import { getAvailableGateways } from '@/lib/services/paymentConfig';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/methods?currency=INR
 *
 * Which payment gateways the checkout may offer right now. Public by design -
 * it exposes only which gateways are available, never a key or a secret.
 *
 * The checkout used to hardcode its tabs, so a gateway switched off in the
 * console still appeared and failed only after the customer had filled the
 * form in.
 */
export async function GET(req: NextRequest) {
  const currency = (req.nextUrl.searchParams.get('currency') || 'INR').toUpperCase();

  try {
    const gateways = await getAvailableGateways(currency);

    return NextResponse.json({
      success: true,
      currency,
      gateways,
      razorpay: gateways.includes('RAZORPAY'),
      instamojo: gateways.includes('INSTAMOJO'),
      // The drawer renders a clear message rather than an empty payment step.
      anyAvailable: gateways.length > 0,
    });
  } catch (error: any) {
    console.error('Payment methods error:', error);
    // Fail closed: offering a gateway we could not confirm is worse than
    // telling the customer payment is unavailable.
    return NextResponse.json(
      {
        success: false,
        currency,
        gateways: [],
        razorpay: false,
        instamojo: false,
        anyAvailable: false,
        error: 'Payment methods are temporarily unavailable.',
      },
      { status: 503 }
    );
  }
}
