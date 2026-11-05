import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';
import { apiClient, isLiveApiConfigured } from '@/lib/api/client';
import { getUpstreamCustomerDetails } from '@/lib/api/customers';
import { getDefaultContacts } from '@/lib/api/contacts';
import { checkDomainAvailability } from '@/lib/api/domains';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/admin/order-diagnostics?order=HMO/2026-27/0001
 *
 * Says why an order did not provision, without placing it.
 *
 * Every check here is read-only: nothing is ordered, no balance is spent. It
 * exists because the stored `provisionError` records only the FIRST thing
 * upstream objected to, and the preconditions behind it - does the customer
 * exist, does it have a usable contact, is the domain still available, is
 * there enough balance - are invisible until an order is attempted and money
 * has already been taken from the customer.
 *
 * Administrators only: it reports upstream ids and customer details.
 */
export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (session instanceof NextResponse) return session;

  const reference = (req.nextUrl.searchParams.get('order') || '').trim();
  if (!reference) {
    return NextResponse.json(
      { success: false, error: 'Pass ?order=<order or invoice number>.' },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { OR: [{ orderNumber: reference }, { invoiceNumber: reference }] },
    include: {
      items: true,
      user: {
        select: {
          id: true, name: true, email: true, phone: true, company: true,
          address: true, city: true, state: true, country: true, zip: true,
          upstreamCustomerId: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ success: false, error: 'No such order.' }, { status: 404 });
  }

  const findings: string[] = [];
  const u = order.user;

  // ---- 1. What the order itself recorded ---------------------------------
  const lines = order.items.map((i) => ({
    description: i.description,
    domainName: i.domainName,
    planId: i.planId,
    productType: i.productType,
    years: i.years,
    provisionStatus: i.provisionStatus,
    provisionAttempts: i.provisionAttempts,
    upstreamOrderId: i.upstreamOrderId,
    // The decisive field. Everything below exists to explain it.
    provisionError: i.provisionError,
  }));

  // ---- 2. The details a registrant contact needs -------------------------
  const contactSource = {
    address: order.billingAddress || u?.address || '',
    city: order.billingCity || u?.city || '',
    state: order.billingState || u?.state || '',
    country: order.billingCountry || u?.country || '',
    zip: order.billingZip || u?.zip || '',
    phone: (u?.phone || '').replace(/\D/g, ''),
    email: u?.email || '',
    name: u?.name || '',
  };
  const missing = Object.entries(contactSource)
    .filter(([, v]) => !String(v).trim())
    .map(([k]) => k);
  if (missing.length) {
    findings.push(
      `The registrant contact cannot be built: missing ${missing.join(', ')}. ` +
        `Upstream rejects the contact, so the order fails after payment.`
    );
  }
  if (contactSource.phone && contactSource.phone.length < 10) {
    findings.push(`The phone number has only ${contactSource.phone.length} digits after stripping punctuation.`);
  }

  if (!isLiveApiConfigured()) {
    return NextResponse.json({
      order: { orderNumber: order.orderNumber, invoiceNumber: order.invoiceNumber, paymentStatus: order.paymentStatus, status: order.status, total: order.totalAmount, currency: order.currency },
      lines,
      contactSource: { ...contactSource, missing },
      findings: [...findings, 'Upstream credentials are not configured, so nothing further could be checked.'],
    });
  }

  // ---- 3. Upstream customer ----------------------------------------------
  let upstreamCustomer: any = null;
  if (!u?.upstreamCustomerId) {
    findings.push('This user has no upstream customer id, so no order can be placed for them.');
  } else {
    const res = await getUpstreamCustomerDetails(u.upstreamCustomerId);
    upstreamCustomer = res.success
      ? {
          id: u.upstreamCustomerId,
          name: (res.data as any)?.name ?? null,
          email: (res.data as any)?.username ?? (res.data as any)?.useremail ?? null,
          address: (res.data as any)?.['customer.address1'] ?? (res.data as any)?.address1 ?? null,
          city: (res.data as any)?.['customer.city'] ?? (res.data as any)?.city ?? null,
          zip: (res.data as any)?.['customer.zip'] ?? (res.data as any)?.zip ?? null,
          phone: (res.data as any)?.['customer.telno'] ?? (res.data as any)?.telno ?? null,
        }
      : { id: u.upstreamCustomerId, error: res.error };
    if (!res.success) {
      findings.push(`Upstream does not recognise customer ${u.upstreamCustomerId}: ${res.error}`);
    }
  }

  // ---- 4. A usable contact ------------------------------------------------
  let contactsOnFile: any = null;
  if (u?.upstreamCustomerId) {
    const res = await getDefaultContacts(u.upstreamCustomerId);
    if (res.success && res.data) {
      const found = Object.values(res.data).find(
        (v: any) => v && typeof v === 'object' && (v.contactid || v.contact_id)
      ) as any;
      contactsOnFile = found
        ? { contactId: String(found.contactid ?? found.contact_id), name: found.name ?? null }
        : null;
      if (!contactsOnFile) {
        findings.push('No default contact exists upstream yet; one will be created on the next attempt.');
      }
    } else {
      contactsOnFile = { error: res.error };
    }
  }

  // ---- 5. Is the domain still available? ---------------------------------
  const availability: any[] = [];
  for (const item of order.items) {
    if (!item.domainName) continue;
    const transferring = /transfer/i.test(item.description);
    if (transferring) continue;
    try {
      const results = await checkDomainAvailability(item.domainName);
      const match = (results || []).find(
        (r: any) => r.domain?.toLowerCase() === item.domainName!.toLowerCase()
      );
      availability.push({
        domain: item.domainName,
        status: match?.status ?? 'unknown',
        available: match?.available ?? null,
      });
      if (match && match.available === false) {
        findings.push(
          `${item.domainName} is no longer available - it was registered by someone else between ` +
            `checkout and fulfilment. This order cannot be completed and should be refunded.`
        );
      }
    } catch (err: any) {
      availability.push({ domain: item.domainName, error: err?.message });
    }
  }

  // ---- 6. Can the balance cover it? --------------------------------------
  let balance: any = null;
  try {
    const res = await apiClient<any>('/billing/reseller-balance.json', {
      'reseller-id': process.env.RESELLER_AUTH_USERID || '',
    });
    if (res.success && res.data) {
      const available = parseFloat(res.data.sellingcurrencybalance || '0');
      const locked = parseFloat(res.data.sellingcurrencylockedbalance || '0');
      balance = {
        currency: res.data.sellingcurrencysymbol || 'INR',
        available,
        locked,
        spendable: available - locked,
      };
      // Upstream charges the reseller GST on top of the wholesale cost, so a
      // balance that looks like it covers the cost may not.
      if (balance.spendable <= 0) {
        findings.push('The reseller balance is exhausted. Nothing can be provisioned until it is topped up.');
      } else if (balance.spendable < 1500) {
        findings.push(
          `The reseller balance is ${balance.currency} ${balance.spendable.toFixed(2)}. ` +
            `A .in registration costs about INR 813 including the 18% charged to you, so this covers ` +
            `very little. If an order failed on funds, this is why.`
        );
      }
    } else {
      balance = { error: res.error };
    }
  } catch (err: any) {
    balance = { error: err?.message };
  }

  if (!findings.length) {
    findings.push(
      'No precondition failed. The stored provisionError on the line above is the authoritative reason; ' +
        'retry the order and it should proceed.'
    );
  }

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      paymentStatus: order.paymentStatus,
      status: order.status,
      total: order.totalAmount,
      currency: order.currency,
      placedAt: order.createdAt,
    },
    lines,
    contactSource: { ...contactSource, missing },
    upstreamCustomer,
    contactsOnFile,
    availability,
    balance,
    findings,
  });
}
