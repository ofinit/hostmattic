import { NextRequest, NextResponse } from 'next/server';
import {
  sendEmail,
  getResendConfig,
  generateOrderReceiptEmail,
  generateExpiryAlertEmail,
  generateTicketReplyEmail,
  generatePasswordResetEmail,
} from '@/lib/email/resend';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/email
 * Check email dispatch configuration & telemetry
 */
export async function GET() {
  const { isConfigured, fromEmail } = getResendConfig();

  return NextResponse.json({
    success: true,
    provider: 'Resend',
    configured: isConfigured,
    fromEmail,
    supportedTypes: [
      'ORDER_RECEIPT',
      'EXPIRATION_ALERT',
      'TICKET_REPLY',
      'PASSWORD_RESET',
      'CUSTOM',
    ],
    status: isConfigured ? 'READY (Live Resend API Active)' : 'SIMULATION_MODE (Set RESEND_API_KEY to activate live delivery)',
  });
}

/**
 * POST /api/notifications/email
 * Send transactional email notification
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type = 'CUSTOM', to, ...data } = body;

    if (!to) {
      return NextResponse.json(
        { success: false, error: 'Recipient email address ("to") is required.' },
        { status: 400 }
      );
    }

    let emailContent: { subject: string; html: string; text?: string };

    switch (type) {
      case 'ORDER_RECEIPT': {
        emailContent = generateOrderReceiptEmail({
          orderNumber: data.orderNumber || 'HM-INV-DEMO',
          customerName: data.customerName || 'Valued Customer',
          items: data.items || [{ description: 'Hostmattic Cloud Service', price: Number(data.totalAmount) || 19.99 }],
          totalAmount: Number(data.totalAmount) || 19.99,
          currency: data.currency || 'USD',
          dashboardUrl: data.dashboardUrl,
        });
        break;
      }

      case 'EXPIRATION_ALERT': {
        emailContent = generateExpiryAlertEmail({
          customerName: data.customerName || 'Valued Customer',
          serviceName: data.serviceName || 'Active Service',
          serviceType: data.serviceType || 'DOMAIN',
          expiryDate: data.expiryDate || new Date(Date.now() + 86400000 * 15).toISOString(),
          daysRemaining: Number(data.daysRemaining) || 15,
          renewalUrl: data.renewalUrl,
        });
        break;
      }

      case 'TICKET_REPLY': {
        emailContent = generateTicketReplyEmail({
          customerName: data.customerName || 'Valued Customer',
          ticketNumber: data.ticketNumber || 'TKT-1001',
          subject: data.subject || 'Support Ticket Update',
          senderName: data.senderName || 'Hostmattic Support',
          message: data.message || 'An engineer has replied to your ticket.',
          ticketUrl: data.ticketUrl,
        });
        break;
      }

      case 'PASSWORD_RESET': {
        emailContent = generatePasswordResetEmail({
          customerName: data.customerName || 'Valued Customer',
          resetUrl: data.resetUrl || 'https://hostmattic.com/login',
        });
        break;
      }

      case 'CUSTOM':
      default: {
        if (!data.subject || !data.html) {
          return NextResponse.json(
            { success: false, error: 'For custom emails, "subject" and "html" are required.' },
            { status: 400 }
          );
        }
        emailContent = {
          subject: data.subject,
          html: data.html,
          text: data.text,
        };
        break;
      }
    }

    const result = await sendEmail({
      to,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    return NextResponse.json({
      success: result.success,
      id: result.id,
      simulated: result.simulated,
      recipient: to,
      subject: emailContent.subject,
      message: result.simulated
        ? 'Email simulated (RESEND_API_KEY not configured in environment).'
        : 'Email dispatched successfully via Resend API.',
      error: result.error,
    });
  } catch (error: any) {
    console.error('[Notification Route Error]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to dispatch email notification' },
      { status: 500 }
    );
  }
}
