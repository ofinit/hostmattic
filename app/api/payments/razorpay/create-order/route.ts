import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { razorpayService } from '@/lib/services/razorpay';
import { validateCurrencyMatch } from '@/lib/services/currencyLock';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { amount, currency, orderNumber, notes } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 });
    }

    const validCurrency = currency === 'USD' ? 'USD' : 'INR';

    // Verify order currency lock against user if order exists
    if (orderNumber) {
      const existingOrder = await prisma.order.findUnique({
        where: { orderNumber },
        include: { user: true },
      });
      if (existingOrder?.user) {
        const match = await validateCurrencyMatch(existingOrder.user.id, validCurrency);
        if (!match.allowed) {
          return NextResponse.json(
            { error: match.error, code: 'CURRENCY_LOCKED', lockedCurrency: match.lockedCurrency },
            { status: 409 }
          );
        }
      }
    }

    const order = await razorpayService.createOrder({
      amount,
      currency: validCurrency,
      receipt: `rcpt_${orderNumber || Date.now().toString().slice(-8)}`,
      notes: {
        orderNumber: orderNumber || 'PENDING',
        ...notes,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.getKeyId(),
      isSimulated: order.isSimulated || false,
    });
  } catch (err: any) {
    console.error('API Error in /api/payments/razorpay/create-order:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error creating Razorpay order' },
      { status: 500 }
    );
  }
}
