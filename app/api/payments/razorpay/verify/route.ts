import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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

    const isValid = razorpayService.verifySignature(
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

    // Find the order in Prisma
    const order = await prisma.order.findFirst({
      where: {
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

    // Update order with payment details
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        gatewayName: 'RAZORPAY',
        gatewayOrderId: razorpayOrderId,
        gatewayPaymentId: razorpayPaymentId,
        gatewaySignature: razorpaySignature || null,
        paymentMethod: paymentMethod || 'RAZORPAY',
      },
      include: {
        items: true,
      },
    });

    if (order.userId && (order.currency === 'USD' || order.currency === 'INR')) {
      await lockCustomerCurrency(order.userId, order.currency as 'USD' | 'INR');
    }

    return NextResponse.json({
      success: true,
      message: 'Razorpay payment verified and order activated',
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
