import { NextRequest, NextResponse } from 'next/server';
import { instamojoService } from '@/lib/services/instamojo';
import { validateCurrencyMatch } from '@/lib/services/currencyLock';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, currency, orderNumber, buyerName, email, phone } = body;

    if (currency !== 'INR') {
      return NextResponse.json(
        { error: 'Instamojo payment gateway exclusively processes INR (₹) transactions. For USD orders, use Razorpay International Card.' },
        { status: 400 }
      );
    }

    if (email) {
      const match = await validateCurrencyMatch(email, 'INR');
      if (!match.allowed) {
        return NextResponse.json(
          { error: match.error, code: 'CURRENCY_LOCKED', lockedCurrency: match.lockedCurrency },
          { status: 409 }
        );
      }
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const result = await instamojoService.createPaymentRequest({
      amount,
      currency: 'INR',
      orderNumber: orderNumber || `HM-${Math.floor(100000 + Math.random() * 900000)}`,
      buyerName: buyerName || 'Hostmattic Customer',
      email: email || 'billing@hostmattic.com',
      phone: phone || '',
    });

    return NextResponse.json({
      success: true,
      paymentRequestId: result.id,
      paymentUrl: result.longurl,
      isSimulated: result.isSimulated || false,
    });
  } catch (err: any) {
    console.error('API Error in /api/payments/instamojo/create-request:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize Instamojo payment request' },
      { status: 500 }
    );
  }
}
