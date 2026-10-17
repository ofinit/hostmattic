/**
 * Lifecycle email templates: payment, activation, renewal, and the operational
 * alerts that go to staff.
 *
 * These sit alongside the originals in resend.ts, which cover the order
 * receipt, password reset, ticket reply and expiry alert. They share that
 * file's wrapper through renderEmail().
 *
 * Two principles run through them:
 *
 *  - say what actually happened. "Activation delayed" is sent when a payment
 *    succeeded and provisioning did not, because the customer has paid and
 *    silence is the worst of the available options;
 *  - never state a figure the system has not got. A renewal notice without a
 *    price says so rather than guessing, which is the same rule the storefront
 *    follows.
 */

import { renderEmail } from './resend';

const money = (amount: number, currency: string) =>
  currency === 'INR'
    ? `₹${Math.round(amount).toLocaleString('en-IN')}`
    : `$${amount.toFixed(2)}`;

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://hostmattic.com';

/** A plain fact table, used across several of these. */
function factTable(rows: Array<[string, string]>): string {
  return `
  <table style="width:100%; border-collapse:collapse; margin:18px 0; font-size:14px;">
    ${rows
      .map(
        ([k, v]) => `
      <tr>
        <td style="padding:8px 0; color:#64748B; width:45%;">${k}</td>
        <td style="padding:8px 0; color:#0F172A; font-weight:600;">${v}</td>
      </tr>`
      )
      .join('')}
  </table>`;
}

// ---------------------------------------------------------------------------
// Customer: money
// ---------------------------------------------------------------------------

/**
 * Sent once a gateway signature has been verified - not at checkout, where the
 * original receipt was sent before any payment had been attempted.
 */
export function generatePaymentReceivedEmail(params: {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  paymentMethod?: string;
  gatewayPaymentId?: string;
}) {
  const { orderNumber, customerName, totalAmount, currency, paymentMethod, gatewayPaymentId } =
    params;

  return {
    subject: `Payment received — ${orderNumber}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#0F172A;">Payment received</h2>
      <p>Thank you, ${customerName}. We have received your payment and your tax invoice is
      available in your dashboard.</p>
      ${factTable([
        ['Invoice number', orderNumber],
        ['Amount paid', money(totalAmount, currency)],
        ['Method', paymentMethod || 'Online'],
        ...(gatewayPaymentId ? [['Reference', gatewayPaymentId] as [string, string]] : []),
      ])}
      <p>Your services are being activated now. We will email you as soon as each one is
      ready.</p>
      <a class="btn" href="${appUrl()}/client/dashboard">View invoice</a>
    `,
      `Payment received for ${orderNumber}`
    ),
  };
}

export function generatePaymentFailedEmail(params: {
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  currency: string;
  reason?: string;
}) {
  const { orderNumber, customerName, totalAmount, currency, reason } = params;

  return {
    subject: `Payment could not be completed — ${orderNumber}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#0F172A;">Your payment did not go through</h2>
      <p>${customerName}, we could not complete the payment for order ${orderNumber}.
      <strong>Nothing has been charged</strong> and no services have been activated.</p>
      ${factTable([
        ['Order', orderNumber],
        ['Amount', money(totalAmount, currency)],
        ...(reason ? [['Reason', reason] as [string, string]] : []),
      ])}
      <p>Your basket is still saved. You can try again, or use a different payment method.</p>
      <a class="btn" href="${appUrl()}/checkout">Complete your order</a>
    `,
      `Payment not completed for ${orderNumber}`
    ),
  };
}

// ---------------------------------------------------------------------------
// Customer: activation
// ---------------------------------------------------------------------------

/** What a customer needs next differs entirely by product. */
function nextSteps(productType: string, domainName?: string): string {
  const t = (productType || '').toUpperCase();

  if (t === 'DOMAIN') {
    return `
      <p>Your domain is registered and pointing at our nameservers:</p>
      <p style="font-family:monospace; background:#F8FAFC; padding:12px; border-radius:8px;">
        ns1.hostmattic.com<br>ns2.hostmattic.com
      </p>
      <p>DNS changes can take up to 24 hours to propagate worldwide. You can manage records
      from your dashboard.</p>`;
  }

  if (t.includes('EMAIL') || t.includes('GAPPS') || t.includes('WORKSPACE')) {
    return `
      <p>Your mailboxes are ready. Create users and set passwords from the control panel in
      your dashboard, then point your MX records at us${
        domainName ? ` for <strong>${domainName}</strong>` : ''
      }.</p>`;
  }

  if (t.includes('SSL')) {
    return `
      <p>Your certificate has been issued. It needs installing on the server where the site is
      hosted — if that is with us, we have done it for you. Otherwise the certificate files are
      in your dashboard.</p>`;
  }

  if (t.includes('VPS') || t.includes('DEDICATED') || t.includes('SERVER')) {
    return `
      <p>Your server is provisioned. Root credentials and the IP address are in your dashboard.
      We strongly recommend adding an SSH key and disabling password login before you put
      anything live.</p>`;
  }

  // Shared, WordPress, cloud, reseller, business hosting.
  return `
    <p>Your hosting account is live. Your control panel login is in your dashboard, where you
    can upload files, create databases and install applications.</p>
    ${
      domainName
        ? `<p>Point <strong>${domainName}</strong> at ns1.hostmattic.com and ns2.hostmattic.com to
           bring the site online.</p>`
        : ''
    }`;
}

export function generateServiceActivatedEmail(params: {
  customerName: string;
  productType: string;
  description: string;
  domainName?: string;
  orderNumber: string;
}) {
  const { customerName, productType, description, domainName, orderNumber } = params;

  return {
    subject: `${description} is now active`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#0F172A;">Your service is active</h2>
      <p>${customerName}, <strong>${description}</strong> has been set up and is ready to use.</p>
      ${nextSteps(productType, domainName)}
      ${factTable([
        ['Service', description],
        ...(domainName ? [['Domain', domainName] as [string, string]] : []),
        ['Order', orderNumber],
      ])}
      <a class="btn" href="${appUrl()}/client/dashboard">Open your dashboard</a>
    `,
      `${description} is ready`
    ),
  };
}

/**
 * Payment succeeded, provisioning did not.
 *
 * Deliberately does not pretend this is routine. The customer has paid for
 * something they have not received, and the honest thing is to say so, say it
 * is being handled, and give a timeframe.
 */
export function generateActivationDelayedEmail(params: {
  customerName: string;
  orderNumber: string;
  descriptions: string[];
}) {
  const { customerName, orderNumber, descriptions } = params;

  return {
    subject: `We are still setting up your order — ${orderNumber}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#0F172A;">Your order needs a moment longer</h2>
      <p>${customerName}, your payment for ${orderNumber} went through, but setting up the
      following did not complete automatically:</p>
      <ul style="padding-left:20px; color:#0F172A;">
        ${descriptions.map((d) => `<li style="margin:6px 0;">${d}</li>`).join('')}
      </ul>
      <p>Our team has been alerted and is completing this by hand. You do not need to do
      anything, and you have not been charged twice. We will email you as soon as it is
      ready — usually within a few hours.</p>
      <p>If you would rather not wait, reply to this email and we will cancel and refund the
      affected items.</p>
      <a class="btn" href="${appUrl()}/client/dashboard">View your order</a>
    `,
      `Setting up ${orderNumber} is taking longer than usual`
    ),
  };
}

// ---------------------------------------------------------------------------
// Customer: renewal
// ---------------------------------------------------------------------------

/**
 * Renewal reminder.
 *
 * `restorePrice` exists because letting a domain lapse is disproportionately
 * expensive — a .co.in renews for about Rs850 and costs about Rs7,300 to
 * restore from redemption. Saying so is the whole point of the message.
 */
export function generateRenewalReminderEmail(params: {
  customerName: string;
  description: string;
  expiresOn: Date;
  daysRemaining: number;
  renewalPrice?: number;
  restorePrice?: number;
  currency: string;
  isDomain?: boolean;
}) {
  const {
    customerName,
    description,
    expiresOn,
    daysRemaining,
    renewalPrice,
    restorePrice,
    currency,
    isDomain,
  } = params;

  const expired = daysRemaining <= 0;
  const urgent = daysRemaining <= 7;

  const heading = expired
    ? 'Your service has expired'
    : daysRemaining === 1
    ? 'Expires tomorrow'
    : `Expires in ${daysRemaining} days`;

  const consequence = expired
    ? isDomain
      ? `<p><strong>Your domain has stopped resolving.</strong> Websites and email on it are
         offline. It can still be renewed during the redemption period, after which it is
         released and anyone may register it.</p>`
      : `<p><strong>This service is no longer active.</strong> Renew now to restore it before the
         data is removed.</p>`
    : urgent
    ? `<p>After it expires, ${
        isDomain
          ? 'your website and email on this domain will stop working'
          : 'the service will be suspended'
      }.</p>`
    : '';

  const priceRows: Array<[string, string]> = [
    ['Service', description],
    [expired ? 'Expired on' : 'Expires on', expiresOn.toLocaleDateString('en-IN')],
  ];
  if (renewalPrice && renewalPrice > 0) {
    priceRows.push(['Renewal price', money(renewalPrice, currency)]);
  }
  if (expired && restorePrice && restorePrice > 0) {
    priceRows.push(['Cost to restore once in redemption', money(restorePrice, currency)]);
  }

  return {
    subject: expired
      ? `Expired: ${description} — renew to restore it`
      : `${description} ${daysRemaining === 1 ? 'expires tomorrow' : `expires in ${daysRemaining} days`}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:${urgent || expired ? '#B91C1C' : '#0F172A'};">
        ${heading}
      </h2>
      <p>${customerName}, this is a reminder about <strong>${description}</strong>.</p>
      ${consequence}
      ${factTable(priceRows)}
      ${
        expired && restorePrice && renewalPrice
          ? `<p style="background:#FEF2F2; border:1px solid #FCA5A5; border-radius:8px; padding:12px; color:#7F1D1D;">
               Renewing now costs ${money(renewalPrice, currency)}. Once it enters redemption the
               cost rises to ${money(restorePrice, currency)}.
             </p>`
          : ''
      }
      <a class="btn" href="${appUrl()}/client/dashboard">Renew now</a>
      <p style="font-size:13px; color:#64748B;">If you have already renewed, please ignore this
      message.</p>
    `,
      `${description} ${expired ? 'has expired' : `expires in ${daysRemaining} days`}`
    ),
  };
}

// ---------------------------------------------------------------------------
// Staff: operational alerts
// ---------------------------------------------------------------------------

export function generateAdminFulfilmentFailedEmail(params: {
  orderNumber: string;
  customerEmail: string;
  failures: Array<{ description: string; error?: string }>;
  amount: number;
  currency: string;
}) {
  const { orderNumber, customerEmail, failures, amount, currency } = params;

  return {
    subject: `[Action needed] Paid order not delivered — ${orderNumber}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#B91C1C;">A paid order was not delivered</h2>
      <p>${money(amount, currency)} has been taken from <strong>${customerEmail}</strong> and
      provisioning failed. The customer is owed these services.</p>
      <table style="width:100%; border-collapse:collapse; margin:18px 0; font-size:13px;">
        <tr style="background:#F8FAFC;">
          <th style="padding:8px; text-align:left; color:#64748B;">Item</th>
          <th style="padding:8px; text-align:left; color:#64748B;">Upstream error</th>
        </tr>
        ${failures
          .map(
            (f) => `
          <tr style="border-top:1px solid #E2E8F0;">
            <td style="padding:8px; color:#0F172A; font-weight:600;">${f.description}</td>
            <td style="padding:8px; color:#B91C1C;">${f.error || 'No error reported'}</td>
          </tr>`
          )
          .join('')}
      </table>
      <p>Retry from the Orders tab, which lists every paid-but-undelivered order.</p>
      <a class="btn" href="${appUrl()}/admin/dashboard">Open the console</a>
    `,
      `${orderNumber}: paid but not provisioned`
    ),
  };
}

/**
 * The reseller account funds every provisioning call. At zero, nothing can be
 * bought for any customer, and the first sign would otherwise be a run of
 * failed orders.
 */
export function generateAdminLowBalanceEmail(params: {
  balance: number;
  currency: string;
  threshold: number;
}) {
  const { balance, currency, threshold } = params;

  return {
    subject: `[Action needed] Reseller balance is low — ${money(balance, currency)}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#B91C1C;">Your reseller balance is running out</h2>
      <p>The upstream account has <strong>${money(balance, currency)}</strong> remaining, below
      the ${money(threshold, currency)} alert threshold.</p>
      <p>Provisioning is funded from this balance. When it reaches zero every registration,
      renewal and hosting order will fail — for all customers at once, and after they have
      paid.</p>
      <a class="btn" href="${appUrl()}/admin/dashboard">Open the console</a>
    `,
      `Reseller balance low: ${money(balance, currency)}`
    ),
  };
}

export function generateAdminNewTicketEmail(params: {
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  priority?: string;
  message: string;
}) {
  const { ticketNumber, customerName, customerEmail, subject, priority, message } = params;

  return {
    subject: `[Support] ${ticketNumber} — ${subject}`,
    html: renderEmail(
      `
      <h2 style="margin:0 0 12px; font-size:20px; color:#0F172A;">New support ticket</h2>
      ${factTable([
        ['Ticket', ticketNumber],
        ['From', `${customerName} (${customerEmail})`],
        ['Subject', subject],
        ['Priority', priority || 'Medium'],
      ])}
      <div style="background:#F8FAFC; border-left:3px solid #29B4D5; padding:12px 14px; margin:16px 0; color:#1E293B;">
        ${message.replace(/</g, '&lt;').replace(/\n/g, '<br>')}
      </div>
      <a class="btn" href="${appUrl()}/admin/dashboard">Reply in the console</a>
    `,
      `${ticketNumber}: ${subject}`
    ),
  };
}
