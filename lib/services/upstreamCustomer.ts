/**
 * Creating the upstream customer account from real data.
 *
 * Signup used to do this with invented values:
 *
 *   address: address || '123 Enterprise Way',
 *   city:    city    || 'New York',
 *   state:   state   || 'NY',
 *   country: country || 'US',
 *   phoneNo: phone   || '1234567890',
 *
 * The signup form collects none of those, so every customer who registered was
 * created upstream at a fictional New York address with a fictional phone
 * number. For a domain registration that record becomes the WHOIS registrant
 * contact, and inaccurate WHOIS is grounds for the registry to suspend the
 * domain.
 *
 * The account is therefore created when real details first exist, which is at
 * checkout: a billing address is collected there because the invoice requires
 * one. Nothing is invented; if a required field is genuinely absent the
 * account is not created and the caller reports why.
 */

import { prisma } from '@/lib/prisma';
import { createUpstreamCustomer } from '@/lib/api/customers';
import crypto from 'crypto';

export interface UpstreamCustomerResult {
  customerId: string | null;
  created: boolean;
  missing?: string[];
  error?: string;
}

/**
 * Returns the user's upstream customer id, creating the account from the
 * order's billing details if they do not yet have one.
 */
export async function ensureUpstreamCustomer(
  userId: string,
  order: {
    billingAddress?: string | null;
    billingCity?: string | null;
    billingState?: string | null;
    billingCountry?: string | null;
    billingZip?: string | null;
  }
): Promise<UpstreamCustomerResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      company: true,
      address: true,
      city: true,
      state: true,
      country: true,
      zip: true,
      upstreamCustomerId: true,
    },
  });

  if (!user) return { customerId: null, created: false, error: 'User not found.' };
  if (user.upstreamCustomerId) {
    return { customerId: user.upstreamCustomerId, created: false };
  }

  // The order's billing details are the authoritative ones - they were entered
  // for an invoice - with the profile as a secondary source.
  const address = order.billingAddress?.trim() || user.address?.trim() || '';
  const city = order.billingCity?.trim() || user.city?.trim() || '';
  const state = order.billingState?.trim() || user.state?.trim() || '';
  const country = order.billingCountry?.trim() || user.country?.trim() || '';
  const zip = order.billingZip?.trim() || user.zip?.trim() || '';
  const phone = user.phone?.trim() || '';

  const missing: string[] = [];
  if (!address) missing.push('address');
  if (!city) missing.push('city');
  if (!state) missing.push('state');
  if (!country) missing.push('country');
  if (!zip) missing.push('postcode');
  if (!phone) missing.push('phone');

  if (missing.length) {
    // Deliberately no substitutes. A domain registered against made-up
    // registrant details can be suspended.
    return {
      customerId: null,
      created: false,
      missing,
      error: `Cannot create the upstream account without: ${missing.join(', ')}.`,
    };
  }

  // The customer never signs into the upstream panel with this - access is by
  // SSO token - so it is random and never shown.
  const passwd = `Hm${crypto.randomBytes(12).toString('base64url')}1!`;

  const res = await createUpstreamCustomer({
    username: user.email,
    passwd,
    name: user.name || user.email,
    company: user.company?.trim() || 'Personal',
    address,
    city,
    state,
    country,
    zipcode: zip,
    phoneNo: phone.replace(/\D/g, '').slice(-10),
  });

  if (!res.success || !res.data?.customerId) {
    return {
      customerId: null,
      created: false,
      error: res.error || 'Upstream declined the customer account.',
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { upstreamCustomerId: res.data.customerId },
  });

  console.log(`[Upstream] Created customer ${res.data.customerId} for ${user.email}`);
  return { customerId: res.data.customerId, created: true };
}
