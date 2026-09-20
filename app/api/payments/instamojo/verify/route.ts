import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { instamojoService } from '@/lib/services/instamojo';
import { lockCustomerCurrency } from '@/lib/services/currencyLock';

export async function POST(req: NextRequest) {
  try {
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

    const order = await prisma.order.findFirst({
      where: { orderNumber },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found in Hostmattic database' },
        { status: 404 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        status: 'COMPLETED',
        gatewayName: 'INSTAMOJO',
        gatewayOrderId: paymentRequestId,
        gatewayPaymentId: paymentId || `imojo_pay_${Date.now()}`,
        paymentMethod: 'INSTAMOJO_UPI',
      },
      include: {
        items: true,
      },
    });

    if (order.userId) {
      await lockCustomerCurrency(order.userId, 'INR');
    }

    return NextResponse.json({
      success: true,
      message: 'Instamojo payment verified and order activated',
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
