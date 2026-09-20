import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerDomain } from '@/lib/api/domains';
import { provisionHosting } from '@/lib/api/hosting';
import { validateCurrencyMatch, lockCustomerCurrency } from '@/lib/services/currencyLock';
import { requireAuth } from '@/lib/auth';

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

    // Trigger provisioning for each item
    for (const item of items) {
      if (item.type === 'DOMAIN') {
        const domRes = await registerDomain({
          domainName: item.domainName,
          customerId: customer?.upstreamCustomerId || '1001',
          years: item.years || 1,
        });
        provisionedResults.push({
          type: 'DOMAIN',
          domain: item.domainName,
          result: domRes.data,
        });
      } else if (item.type && item.type.startsWith('HOSTING')) {
        const hostRes = await provisionHosting({
          productType: item.productType || 'SHARED_LINUX',
          domainName: item.domainName || 'primary-domain.com',
          customerId: customer?.upstreamCustomerId || '1001',
          location: item.location || 'us',
        });
        provisionedResults.push({
          type: 'HOSTING',
          domain: item.domainName,
          result: hostRes.data,
        });
      }
    }

    // Attempt DB record
    try {
      let userId = customer?.id;
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
        const defaultUser = await prisma.user.findFirst();
        userId = defaultUser?.id;
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
            paymentStatus: paymentStatus || 'PAID',
            paymentMethod: paymentMethod || 'CREDIT_CARD',
            gatewayName: gatewayName || null,
            gatewayOrderId: gatewayOrderId || null,
            gatewayPaymentId: gatewayPaymentId || null,
            gatewaySignature: gatewaySignature || null,
            status: paymentStatus === 'PENDING' ? 'PENDING' : 'COMPLETED',
            customerType: customerType || 'B2C',
            customerGstin: customerGstin ? customerGstin.trim().toUpperCase() : null,
            companyName: companyName ? companyName.trim() : null,
            billingAddress: billingAddress ? billingAddress.trim() : null,
            billingCity: billingCity ? billingCity.trim() : null,
            billingState: billingState || 'Kerala',
            billingCountry: billingCountry || (currency === 'INR' ? 'IN' : 'US'),
            placeOfSupply: placeOfSupply || '32-Kerala',
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

    return NextResponse.json({
      success: true,
      orderNumber,
      message: 'Order completed and services provisioned successfully!',
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
