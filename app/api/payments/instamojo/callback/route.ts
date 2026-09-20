import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { instamojoService } from '@/lib/services/instamojo';
import { lockCustomerCurrency } from '@/lib/services/currencyLock';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const paymentId = searchParams.get('payment_id');
  const paymentRequestId = searchParams.get('payment_request_id');
  const orderNumber = searchParams.get('orderNumber');

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!orderNumber || !paymentRequestId) {
    return NextResponse.redirect(`${appUrl}/checkout?error=Invalid_Instamojo_Callback`);
  }

  // SECURITY: Only trust server-side verification — never trust query params for payment status
  const verification = await instamojoService.verifyPaymentStatus(paymentRequestId, paymentId || undefined);

  if (verification.isPaid) {
    try {
      const order = await prisma.order.findFirst({
        where: { orderNumber },
      });

      if (order) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            status: 'COMPLETED',
            gatewayName: 'INSTAMOJO',
            gatewayOrderId: paymentRequestId,
            gatewayPaymentId: paymentId || `imojo_${Date.now()}`,
            paymentMethod: 'INSTAMOJO_UPI',
          },
        });

        if (order.userId) {
          await lockCustomerCurrency(order.userId, 'INR');
        }
      }
    } catch (err) {
      console.error('Error updating order on Instamojo callback:', err);
    }

    return NextResponse.redirect(`${appUrl}/client/dashboard?orderSuccess=${encodeURIComponent(orderNumber)}&gateway=instamojo`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=Payment_Failed_Or_Cancelled&orderNumber=${encodeURIComponent(orderNumber)}`);
}
