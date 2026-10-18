import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { instamojoService } from '@/lib/services/instamojo';
import { lockCustomerCurrency } from '@/lib/services/currencyLock';
import { fulfilOrder } from '@/lib/services/fulfilment';
import { sendEmail } from '@/lib/email/resend';
import { generatePaymentReceivedEmail } from '@/lib/email/lifecycle';

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
        include: { user: { select: { name: true, email: true } } },
      });

      if (order) {
        const updated = await prisma.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            // Delivered, not merely paid. This said COMPLETED and then
            // provisioned nothing, so an order that had never reached upstream
            // looked finished and never appeared as outstanding work.
            status: 'AWAITING_FULFILMENT',
            gatewayName: 'INSTAMOJO',
            gatewayOrderId: paymentRequestId,
            gatewayPaymentId: paymentId || `imojo_${Date.now()}`,
            paymentMethod: 'INSTAMOJO_UPI',
          },
        });

        if (order.userId) {
          await lockCustomerCurrency(order.userId, 'INR');
        }

        // Instamojo's redirect flow lands here, not on the verify route, so
        // this path has to do everything the verify routes do. It previously
        // did neither of these: the customer got no receipt and the order was
        // never sent upstream.
        if (order.user?.email) {
          const mail = generatePaymentReceivedEmail({
            orderNumber: updated.orderNumber,
            customerName: order.user.name || 'there',
            totalAmount: updated.totalAmount,
            currency: updated.currency,
            paymentMethod: 'INSTAMOJO_UPI',
            gatewayPaymentId: updated.gatewayPaymentId || undefined,
          });
          sendEmail({ to: order.user.email, subject: mail.subject, html: mail.html }).catch((e) =>
            console.warn('[Instamojo callback] receipt email failed:', e?.message)
          );
        }

        try {
          await fulfilOrder(order.id);
        } catch (fulfilErr: any) {
          console.error(
            `[Instamojo callback] ${orderNumber} could not be fulfilled: ${fulfilErr?.message}`
          );
        }
      }
    } catch (err) {
      console.error('Error updating order on Instamojo callback:', err);
    }

    return NextResponse.redirect(`${appUrl}/client/dashboard?orderSuccess=${encodeURIComponent(orderNumber)}&gateway=instamojo`);
  }

  return NextResponse.redirect(`${appUrl}/checkout?error=Payment_Failed_Or_Cancelled&orderNumber=${encodeURIComponent(orderNumber)}`);
}
