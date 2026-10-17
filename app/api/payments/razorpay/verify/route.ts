import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email/resend';
import { generatePaymentReceivedEmail } from '@/lib/email/lifecycle';
import { fulfilOrder } from '@/lib/services/fulfilment';
import { razorpayService } from '@/lib/services/razorpay';
import { lockCustomerCurrency } from '@/lib/services/currencyLock';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const {
      orderNumber,
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentMethod,
    } = body;

    if (!razorpayOrderId || !razorpayPaymentId) {
      return NextResponse.json(
        { error: 'Missing Razorpay order or payment transaction references' },
        { status: 400 }
      );
    }

    // Annotated deliberately: verifySignature is async, and a Promise is always
    // truthy, so dropping the await would make every payment verify as valid.
    // The explicit boolean makes that a compile error rather than a silent hole.
    const isValid: boolean = await razorpayService.verifySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature || ''
    );

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid cryptographic signature from Razorpay' },
        { status: 400 }
      );
    }

    // Scope the lookup to the caller. Without `userId` any signed-in customer
    // could settle somebody else's order simply by quoting its number, and
    // order numbers are guessable.
    const order = await prisma.order.findFirst({
      where: {
        userId: session.id,
        OR: [
          ...(orderId ? [{ id: orderId }] : []),
          ...(orderNumber ? [{ orderNumber: orderNumber }] : []),
        ],
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found in Hostmattic database' },
        { status: 404 }
      );
    }

    // Settling an already-paid order again would overwrite a real gateway
    // reference with a later one; treat it as a no-op success instead.
    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        orderNumber: order.orderNumber,
        message: 'This order is already marked paid.',
      });
    }

    // Update order with payment details
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        // Delivered, not merely paid. fulfilOrder below promotes this to
        // COMPLETED only when every line is actually provisioned.
        status: 'AWAITING_FULFILMENT',
        gatewayName: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        gatewaySignature: razorpaySignature || null,
        paymentMethod: paymentMethod || 'RAZORPAY',
      },
      include: {
        items: true,
        user: { select: { name: true, email: true } },
      },
    });

    if (order.userId && (order.currency === 'USD' || order.currency === 'INR')) {
      await lockCustomerCurrency(order.userId, order.currency as 'USD' | 'INR');
    }

    // Payment is confirmed, so the services are now owed. Provisioning happens
    // here and nowhere earlier: checkout runs before the payment window even
    // opens, so anything provisioned there was given away on trust.
    //
    // A failure must not fail the payment - the money is taken and the order
    // is real. The lines are marked FAILED, the order becomes
    // AWAITING_FULFILMENT and an administrator can retry.

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
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'AWAITING_FULFILMENT' },
      });
    }

    return NextResponse.json({
      success: true,
      fulfilment,
      message: fulfilment && fulfilment.failed > 0
        ? 'Payment verified. Some services need a moment to activate and our team has been notified.'
        : 'Razorpay payment verified and order activated',
      order: updatedOrder,
    });
  } catch (err: any) {
    console.error('API Error in /api/payments/razorpay/verify:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error verifying Razorpay payment' },
      { status: 500 }
    );
  }
}
