import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { generatePaymentReceivedEmail } from '@/lib/email/lifecycle';
import { instamojoService } from '@/lib/services/instamojo';
import { lockCustomerCurrency } from '@/lib/services/currencyLock';
import { fulfilOrder } from '@/lib/services/fulfilment';

export async function POST(req: NextRequest) {
  try {
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const { orderNumber, paymentRequestId, paymentId } = body;

    if (!paymentRequestId) {
      return NextResponse.json(
        { error: 'paymentRequestId is required' },
        { status: 400 }
      );
    }

    const verification = await instamojoService.verifyPaymentStatus(paymentRequestId, paymentId);

    if (!verification.isPaid) {
      return NextResponse.json(
        { error: `Instamojo payment status is not completed: ${verification.status}` },
        { status: 400 }
      );
    }

    // Scope to the caller, as on the Razorpay path: order numbers are
    // guessable, so an unscoped lookup lets anyone settle another
    // customer's order.
    const order = await prisma.order.findFirst({
      where: { orderNumber, userId: session.id },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found in Hostmattic database' },
        { status: 404 }
      );
    }

    // Settling an already-paid order again would overwrite a real gateway
    // reference with a later one. The Razorpay path guards this; this one did
    // not.
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        orderNumber: order.orderNumber,
        message: 'This order is already marked paid.',
      });
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        // Delivered, not merely paid - fulfilment below decides whether this
        // becomes COMPLETED or AWAITING_FULFILMENT.
        status: 'AWAITING_FULFILMENT',
        gatewayName: 'INSTAMOJO',
        gatewayOrderId: paymentRequestId,
        gatewayPaymentId: paymentId || `imojo_pay_${Date.now()}`,
        paymentMethod: 'INSTAMOJO_UPI',
      },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (order.userId) {
      await lockCustomerCurrency(order.userId, 'INR');
    }

    // Payment confirmed, so the services are now owed. A provisioning failure
    // must not fail the payment: the lines are marked FAILED and the order
    // stays AWAITING_FULFILMENT for an administrator to retry.

    // Sent here, not at checkout. The original receipt went out before the
    // payment window had even opened, so it confirmed a payment that had not
    // happened.
    try {
      const recipient = updatedOrder.user?.email;
      if (recipient) {
        const mail = generatePaymentReceivedEmail({
          orderNumber: updatedOrder.orderNumber,
          customerName: updatedOrder.user?.name || 'there',
          totalAmount: updatedOrder.totalAmount,
          currency: updatedOrder.currency,
          paymentMethod: updatedOrder.paymentMethod || undefined,
          gatewayPaymentId: updatedOrder.gatewayPaymentId || undefined,
        });
        sendEmail({ to: recipient, subject: mail.subject, html: mail.html }).catch((e) =>
          console.warn('[Payment] receipt email failed:', e?.message)
        );
      }
    } catch (mailErr: any) {
      console.warn('[Payment] receipt email error:', mailErr?.message);
    }
    let fulfilment = null;
    try {
      fulfilment = await fulfilOrder(order.id);
    } catch (fulfilErr: any) {
      console.error(
        `[Fulfilment] ${order.orderNumber} could not be fulfilled after payment: ${fulfilErr?.message}`
      );
    }

    return NextResponse.json({
      success: true,
      fulfilment,
      message:
        fulfilment && fulfilment.failed > 0
          ? 'Payment verified. Some services need a moment to activate and our team has been notified.'
          : 'Instamojo payment verified and order activated',
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('API Error in /api/payments/instamojo/verify:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error verifying Instamojo payment' },
      { status: 500 }
    );
  }
}
