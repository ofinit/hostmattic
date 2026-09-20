/**
 * Hostmattic Transactional Email Service via Resend API
 *
 * Provides native REST API email dispatch with zero external dependencies.
 * Automatically falls back to simulated logging when RESEND_API_KEY is not yet configured.
 */

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  simulated?: boolean;
  error?: string;
}

export const getResendConfig = () => {
  const apiKey = process.env.RESEND_API_KEY || '';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'Hostmattic <notifications@hostmattic.com>';
  const isConfigured = !!apiKey && apiKey.trim().length > 0;
  return { apiKey, fromEmail, isConfigured };
};

/**
 * Dispatch an email via the Resend REST API
 */
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const { apiKey, fromEmail, isConfigured } = getResendConfig();
  const recipientList = Array.isArray(payload.to) ? payload.to : [payload.to];

  // In sandbox/preview or when API key is unset, provide simulation
  if (!isConfigured) {
    const simId = 'sim_' + Math.random().toString(36).substring(2, 11);
    console.log(`[Resend Notice: Simulated Email] To: ${recipientList.join(', ')} | Subject: "${payload.subject}" | ID: ${simId}`);
    return {
      success: true,
      id: simId,
      simulated: true,
    };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.from || fromEmail,
        to: recipientList,
        subject: payload.subject,
        html: payload.html,
        text: payload.text || undefined,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[Resend API Error]', data);
      return {
        success: false,
        error: data.message || `Resend API rejected request with status ${res.status}`,
      };
    }

    return {
      success: true,
      id: data.id,
      simulated: false,
    };
  } catch (err: any) {
    console.error('[Resend Network Error]', err);
    return {
      success: false,
      error: err.message || 'Failed to communicate with Resend API',
    };
  }
}

// ============================================================================
// BRANDED EMAIL TEMPLATES
// ============================================================================

const getEmailBaseWrapper = (content: string, preheader: string = '') => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hostmattic Cloud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B1320; margin: 0; padding: 0; color: #334155; }
    .container { max-width: 600px; margin: 30px auto; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.25); }
    .header { background: #0F172A; padding: 28px 32px; border-bottom: 3px solid #9BCB44; text-align: left; }
    .content { padding: 32px; font-size: 15px; line-height: 1.6; color: #1E293B; }
    .btn { display: inline-block; background: #4F7C12; color: #FFFFFF !important; font-weight: 700; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; margin: 20px 0; text-align: center; }
    .footer { background: #F8FAFC; padding: 24px 32px; text-align: center; font-size: 12px; color: #64748B; border-top: 1px solid #E2E8F0; }
  </style>
</head>
<body style="background-color: #0B1320; margin: 0; padding: 20px 10px;">
  <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
  <div class="container">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="color: #9BCB44; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">HOSTMATTIC</span>
        <span style="color: #29B4D5; font-size: 11px; font-weight: 700; background: rgba(41,180,213,0.15); padding: 2px 8px; border-radius: 4px; margin-left: 6px;">CLOUD</span>
      </div>
      <div style="color: #94A3B8; font-size: 12px; margin-top: 4px;">Premium Cloud Hosting &amp; Domain Management</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px;">Hostmattic Technologies &bull; Fast, Resilient Cloud Infrastructure</p>
      <p style="margin: 0; color: #94A3B8;">For support inquiries, reach us at <a href="mailto:support@hostmattic.com" style="color: #0284C7; text-decoration: underline;">support@hostmattic.com</a></p>
    </div>
  </div>
</body>
</html>
`;

/**
 * 1. Order Confirmation & Tax Receipt Email
 */
export function generateOrderReceiptEmail(params: {
  orderNumber: string;
  customerName: string;
  items: Array<{ description: string; price: number; billingPeriod?: string }>;
  totalAmount: number;
  currency: string;
  dashboardUrl?: string;
}) {
  const { orderNumber, customerName, items, totalAmount, currency, dashboardUrl } = params;
  const isINR = currency === 'INR';
  const formattedTotal = isINR
    ? `₹${Math.round(totalAmount).toLocaleString()}`
    : `$${Number(totalAmount).toFixed(2)}`;

  const itemsHtml = items
    .map(
      (it) => `
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 12px 0; color: #0F172A; font-weight: 600;">${it.description}</td>
        <td style="padding: 12px 0; color: #64748B; font-size: 13px;">${it.billingPeriod || 'ANNUAL'}</td>
        <td style="padding: 12px 0; text-align: right; font-weight: 700; color: #0F172A;">
          ${isINR ? `₹${Math.round(it.price).toLocaleString()}` : `$${Number(it.price).toFixed(2)}`}
        </td>
      </tr>`
    )
    .join('');

  const body = `
    <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 8px;">Order Confirmed &amp; Service Provisioned! 🚀</h2>
    <p style="color: #64748B; margin: 0 0 20px;">Dear ${customerName}, thank you for choosing Hostmattic. Your order <strong>${orderNumber}</strong> has been successfully processed.</p>
    
    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="border-bottom: 2px solid #E2E8F0; text-align: left; color: #64748B; font-size: 12px;">
            <th style="padding-bottom: 8px;">SERVICE ITEM</th>
            <th style="padding-bottom: 8px;">CYCLE</th>
            <th style="padding-bottom: 8px; text-align: right;">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
          <tr>
            <td colspan="2" style="padding-top: 14px; font-weight: 800; font-size: 15px; color: #0F172A;">Total Paid</td>
            <td style="padding-top: 14px; text-align: right; font-weight: 800; font-size: 18px; color: #4F7C12;">${formattedTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${dashboardUrl || 'https://hostmattic.com/client/dashboard'}" class="btn" style="color: #FFFFFF !important;">
        Access My Control Panel &amp; Services →
      </a>
    </div>

    <p style="font-size: 13px; color: #64748B; margin-top: 24px;">
      Your active services (DNS records, nameservers, server IP, and cPanel single-sign-on) are accessible immediately inside your client dashboard.
    </p>
  `;

  return {
    subject: `Order Receipt & Provisioning Confirmation: ${orderNumber}`,
    html: getEmailBaseWrapper(body, `Order receipt for ${orderNumber} - Hostmattic Cloud`),
  };
}

/**
 * 2. 30-Day / 7-Day Expiration & Renewal Alert Email
 */
export function generateExpiryAlertEmail(params: {
  customerName: string;
  serviceName: string;
  serviceType: 'DOMAIN' | 'HOSTING' | 'SECURITY';
  expiryDate: string;
  daysRemaining: number;
  renewalUrl?: string;
}) {
  const { customerName, serviceName, serviceType, expiryDate, daysRemaining, renewalUrl } = params;
  const isUrgent = daysRemaining <= 7;
  const formattedDate = new Date(expiryDate).toLocaleDateString();

  const body = `
    <div style="background: ${isUrgent ? '#FEE2E2' : '#FEF3C7'}; border: 1px solid ${isUrgent ? '#FCA5A5' : '#FDE68A'}; padding: 14px 18px; border-radius: 10px; margin-bottom: 20px;">
      <strong style="color: ${isUrgent ? '#991B1B' : '#B45309'}; font-size: 16px;">
        ⚠️ Service Renewal Required (${daysRemaining} Days Remaining)
      </strong>
      <div style="color: ${isUrgent ? '#7F1D1D' : '#92400E'}; font-size: 13px; margin-top: 4px;">
        Your ${serviceType} subscription for <strong>${serviceName}</strong> is due to expire on <strong>${formattedDate}</strong>.
      </div>
    </div>

    <p>Dear ${customerName},</p>
    <p>
      To prevent disruption to your website, DNS delegation, and server uptime, please renew your service before the expiration date. 
      Expired domains risk suspension, redemption fees, and potential loss of registration.
    </p>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #64748B;">Service:</span>
        <strong style="color: #0F172A;">${serviceName}</strong>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
        <span style="color: #64748B;">Category:</span>
        <strong style="color: #0284C7;">${serviceType}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #64748B;">Expiry Date:</span>
        <strong style="color: #DC2626;">${formattedDate} (${daysRemaining} days left)</strong>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${renewalUrl || 'https://hostmattic.com/client/dashboard'}" class="btn" style="background: #DC2626; color: #FFFFFF !important;">
        Renew Service Now 💳
      </a>
    </div>
  `;

  return {
    subject: `[Action Required] Expiration Alert: ${serviceName} expires in ${daysRemaining} days`,
    html: getEmailBaseWrapper(body, `Urgent: ${serviceName} renewal due in ${daysRemaining} days`),
  };
}

/**
 * 3. Support Ticket Reply Notification Email
 */
export function generateTicketReplyEmail(params: {
  customerName: string;
  ticketNumber: string;
  subject: string;
  senderName: string;
  message: string;
  ticketUrl?: string;
}) {
  const { customerName, ticketNumber, subject, senderName, message, ticketUrl } = params;

  const body = `
    <h2 style="font-size: 19px; color: #0F172A; margin: 0 0 10px;">New Reply on Ticket #${ticketNumber}</h2>
    <p style="color: #64748B; margin: 0 0 20px;">Dear ${customerName}, our engineering team has updated your support inquiry.</p>

    <div style="background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
        <span style="font-size: 16px;">🛡️</span>
        <strong style="color: #166534; font-size: 14px;">${senderName} (Hostmattic Support)</strong>
      </div>
      <div style="color: #1F2937; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">
        ${message}
      </div>
    </div>

    <div style="text-align: center;">
      <a href="${ticketUrl || 'https://hostmattic.com/client/dashboard'}" class="btn" style="color: #FFFFFF !important;">
        View Ticket &amp; Reply Online →
      </a>
    </div>
  `;

  return {
    subject: `[Ticket #${ticketNumber}] New Reply: ${subject}`,
    html: getEmailBaseWrapper(body, `Support update on ticket #${ticketNumber}`),
  };
}

/**
 * 4. Password Reset Email
 */
export function generatePasswordResetEmail(params: {
  customerName: string;
  resetUrl: string;
}) {
  const { customerName, resetUrl } = params;

  const body = `
    <h2 style="font-size: 20px; color: #0F172A; margin: 0 0 10px;">Password Reset Request</h2>
    <p style="color: #475569;">Hello ${customerName},</p>
    <p style="color: #475569;">We received a request to reset your password for your Hostmattic Client Account. Click the button below to set a new password:</p>

    <div style="text-align: center; margin: 26px 0;">
      <a href="${resetUrl}" class="btn" style="color: #FFFFFF !important;">
        Reset My Password 🔒
      </a>
    </div>

    <p style="font-size: 13px; color: #64748B;">
      This password reset link is valid for <strong>1 hour</strong>. If you did not make this request, you can safely ignore this email; your account remains secure.
    </p>
  `;

  return {
    subject: 'Hostmattic Account Password Reset Request',
    html: getEmailBaseWrapper(body, 'Hostmattic password reset link'),
  };
}
