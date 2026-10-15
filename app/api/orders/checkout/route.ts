import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSellablePlan } from '@/lib/api/hostingPricing';
import { repriceCart } from '@/lib/services/cartPricing';
import { validateCurrencyMatch, lockCustomerCurrency } from '@/lib/services/currencyLock';
import { requireAuth } from '@/lib/auth';
import { sendEmail, generateOrderReceiptEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // SECURITY: Require authentication
    const session = requireAuth(req);
    if (session instanceof NextResponse) return session;

    const body = await req.json();
    const {
      items,
      customer,
      totalAmount,
      subtotalAmount,
      taxRate,
      taxAmount,
      currency,
      customerType,
      customerGstin,
      companyName,
      billingAddress,
      billingCity,
      billingState,
      billingCountry,
      placeOfSupply,
      taxType,
      cgstAmount,
      sgstAmount,
      igstAmount,
      paymentMethod,
      paymentStatus,
      gatewayName,
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Order must contain at least one item.' },
        { status: 400 }
      );
    }

    const orderCurrency = currency === 'INR' ? 'INR' : 'USD';

    // Verify Customer Currency Lock
    const customerIdentifier = customer?.id || customer?.email;
    if (customerIdentifier) {
      const matchResult = await validateCurrencyMatch(customerIdentifier, orderCurrency);
      if (!matchResult.allowed) {
        return NextResponse.json(
          {
            success: false,
            code: 'CURRENCY_LOCKED',
            lockedCurrency: matchResult.lockedCurrency,
            error: matchResult.error,
          },
          { status: 409 }
        );
      }
    }

    const orderNumber = 'HM-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900);
    const provisionedResults: any[] = [];

    // Refuse anything the provider could not deliver, before taking an order
    // for it. A hosting plan upstream has paused, or does not price, cannot be
    // provisioned however the payment goes.
    for (const item of items) {
      if (!item?.type || !String(item.type).startsWith('HOSTING')) continue;

      const price = Number(item.price);
      if (!Number.isFinite(price) || price <= 0) {
        // `Number(it.price) || 0` further down would otherwise record this as
        // a free line item rather than rejecting it.
        return NextResponse.json(
          {
            success: false,
            error: `No valid price was supplied for "${item.name || item.productType}".`,
          },
          { status: 400 }
        );
      }

      // `name` is the page's marketing label; upstream knows the plan by the
      // name the cart carries in upstreamPlan.
      const plan = await getSellablePlan(
        item.productType || 'SHARED_LINUX',
        item.upstreamPlan || item.name || ''
      );
      if (!plan) {
        return NextResponse.json(
          {
            success: false,
            code: 'PLAN_UNAVAILABLE',
            error:
              `"${item.name}" is not currently available to order. ` +
              'Please choose another plan or contact support.',
          },
          { status: 409 }
        );
      }

      // Upstream sells hosting on a minimum tenure. Collecting one month
      // against a twelve-month commitment is a loss on every sale.
      const requestedMonths = item.period === 'monthly' || item.billingPeriod === 'monthly' ? 1 : 12;
      if (requestedMonths < plan.minTenureMonths) {
        return NextResponse.json(
          {
            success: false,
            code: 'TERM_UNAVAILABLE',
            error:
              `"${item.name}" is only sold on a minimum term of ` +
              `${plan.minTenureMonths} months.`,
          },
          { status: 409 }
        );
      }
    }

    // Place of supply decides CGST+SGST against IGST. Defaulting it to the
    // seller's own state produced Kerala invoices for out-of-state customers,
    // which is the wrong tax on a document that has to be filed.
    if ((billingCountry || 'IN') === 'IN' && !String(placeOfSupply || '').trim()) {
      return NextResponse.json(
        {
          success: false,
          code: 'PLACE_OF_SUPPLY_REQUIRED',
          error: 'Please select your state so GST can be applied correctly.',
        },
        { status: 400 }
      );
    }

    // Price every line again from the live catalogue. The cart lives in the
    // browser's localStorage and stores the price as it was when the item was
    // added, so a cart filled before a price change still quotes the old
    // figure - and checkout used to take that figure on trust.
    const { checks, mismatches } = await repriceCart(items, orderCurrency);

    if (mismatches.length) {
      return NextResponse.json(
        {
          success: false,
          code: 'PRICE_CHANGED',
          error:
            'Prices in your basket are out of date. Please review the updated ' +
            'amounts and try again.',
          lines: mismatches.map((m) => ({
            item: m.name,
            was: m.submitted,
            now: m.expected,
          })),
        },
        { status: 409 }
      );
    }

    const unverified = checks.filter((c) => c.status === 'unverified');
    if (unverified.length) {
      // Not fatal - refusing everything we cannot price would block more sales
      // than it protects - but it should be visible.
      console.warn(
        '[Checkout] Could not verify pricing for: ' +
          unverified.map((u) => `${u.name} (${u.detail})`).join('; ')
      );
    }

    // NOTE: provisioning deliberately does NOT happen here.
    //
    // The checkout form posts paymentStatus 'PENDING' and only then opens the
    // payment gateway, so at this point payment has definitionally not been
    // made. Provisioning here handed over the goods before any money moved,
    // and a customer who closed the payment window kept the service. The order
    // is recorded PENDING and fulfilment belongs to the verified-payment path.

    // Attempt DB record
    try {
      // The authenticated session owns this order. This route is behind
      // requireAuth, so there is always a signed-in user, and the identity
      // fields in the checkout form are only ever for display and invoicing.
      //
      // Previously the order was bound to whatever email was typed into the
      // form, creating a second account when it did not match, and falling back
      // to `prisma.user.findFirst()` - an arbitrary row, in practice usually the
      // seeded administrator - when nothing resolved. That silently attached
      // customers' orders to the wrong account, and during admin impersonation
      // put the customer's purchase on the administrator.
      let userId: string | undefined = session.id;

      // Only when genuinely unauthenticated (not currently reachable, kept for
      // a future guest-checkout flow) fall back to the submitted identity.
      if (!userId && customer?.email) {
        let existing = await prisma.user.findUnique({ where: { email: customer.email } });
        if (!existing && customer.password) {
          const bcrypt = await import('bcryptjs');
          const hashedPassword = await bcrypt.hash(customer.password, 10);
          existing = await prisma.user.create({
            data: {
              email: customer.email,
              name: customer.name || 'Valued Customer',
              passwordHash: hashedPassword,
              role: 'CUSTOMER',
            },
          });
        }
        userId = existing?.id;
      }

      if (!userId) {
        // Never attach an order to an arbitrary account.
        console.error('[Checkout] No user could be resolved for order', orderNumber);
        return NextResponse.json(
          { success: false, error: 'Could not determine the account for this order. Please sign in and try again.' },
          { status: 400 }
        );
      }

      if (userId) {
        await prisma.order.create({
          data: {
            orderNumber,
            userId,
            subtotalAmount: Number(subtotalAmount) || Number(totalAmount) || 0,
            taxRate: Number(taxRate) || 0,
            taxAmount: Number(taxAmount) || 0,
            totalAmount: Number(totalAmount) || 0,
            currency: currency || 'USD',
            // An order is created unpaid. Only a verified gateway callback may
            // mark it PAID; defaulting to PAID here meant any client that
            // omitted the field got a settled, provisioned order for free.
            paymentStatus: paymentStatus === 'PAID' ? 'PENDING' : (paymentStatus || 'PENDING'),
            paymentMethod: paymentMethod || 'CREDIT_CARD',
            gatewayName: gatewayName || null,
            gatewayOrderId: gatewayOrderId || null,
            gatewayPaymentId: gatewayPaymentId || null,
            gatewaySignature: gatewaySignature || null,
            status: 'PENDING',
            customerType: customerType || 'B2C',
            customerGstin: customerGstin ? customerGstin.trim().toUpperCase() : null,
            companyName: companyName ? companyName.trim() : null,
            billingAddress: billingAddress ? billingAddress.trim() : null,
            billingCity: billingCity ? billingCity.trim() : null,
            billingState: billingState || null,
            billingCountry: billingCountry || (currency === 'INR' ? 'IN' : 'US'),
            placeOfSupply: placeOfSupply || null,
            taxType: taxType || (currency === 'INR' ? 'CGST_SGST' : 'LUT_EXPORT'),
            cgstAmount: Number(cgstAmount) || 0,
            sgstAmount: Number(sgstAmount) || 0,
            igstAmount: Number(igstAmount) || 0,
            items: {
              create: items.map((it: any) => ({
                productType: it.type || 'SERVICE',
                description: it.name || it.domainName || 'Hostmattic Cloud Service',
                sacCode: it.sacCode || '998315',
                price: Number(it.price) || 0,
                billingPeriod: it.period || 'ANNUAL',
              })),
            },
          },
        });

        // If directly paid, lock user currency
        if (paymentStatus === 'PAID' || !paymentStatus) {
          await lockCustomerCurrency(userId, orderCurrency);
        }
      }
    } catch (dbErr) {
      console.warn('[Checkout DB Notice] DB logging bypassed in preview:', dbErr);
    }

    // Send Transactional Order Confirmation Email via Resend
    const recipientEmail = customer?.email || session?.email;
    if (recipientEmail) {
      try {
        const emailContent = generateOrderReceiptEmail({
          orderNumber,
          customerName: customer?.name || session?.name || 'Valued Customer',
          items: items.map((it: any) => ({
            description: it.name || it.domainName || 'Hostmattic Cloud Service',
            price: Number(it.price) || 0,
            billingPeriod: it.period || 'ANNUAL',
          })),
          totalAmount: Number(totalAmount) || 0,
          currency: currency || 'USD',
          dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostmattic.com'}/client/dashboard`,
        });

        sendEmail({
          to: recipientEmail,
          subject: emailContent.subject,
          html: emailContent.html,
        }).catch((e) => console.warn('[Order Email Dispatch Warning]', e));
      } catch (mailErr) {
        console.warn('[Order Mail Notice]', mailErr);
      }
    }

    return NextResponse.json({
      success: true,
      orderNumber,
      awaitingPayment: true,
      message: 'Order placed. Services are activated once payment is confirmed.',
      provisioned: provisionedResults,
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Checkout failed' },
      { status: 500 }
    );
  }
}
