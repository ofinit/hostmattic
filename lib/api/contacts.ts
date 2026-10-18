/**
 * Registrant contacts.
 *
 * A domain order needs four contact ids - registrant, admin, technical and
 * billing - and they are separate upstream entities from the customer account.
 * Neither registerDomain nor transferDomain supplied them, which is why the
 * first real order failed with "Required parameter missing: reg-contact-id".
 *
 * These become the public WHOIS record for the domain, so everything here is
 * built from the customer's actual details. Nothing is substituted: a contact
 * assembled from invented data is exactly what gets a domain suspended.
 */

import { apiClient, isLiveApiConfigured, ApiResponse } from './client';

export interface ContactDetails {
  name: string;
  company: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zipcode: string;
  phoneCc: string;
  phone: string;
}

export interface DomainContactIds {
  registrant: string;
  admin: string;
  tech: string;
  billing: string;
}

/**
 * The customer's existing default contacts, if upstream already holds them.
 * Reusing one avoids creating a duplicate on every order.
 */
export async function getDefaultContacts(
  customerId: string
): Promise<ApiResponse<Record<string, any>>> {
  return apiClient('/contacts/default.json', {
    'customer-id': customerId,
    'type-list': 'Contact',
  });
}

/** Creates a contact and returns its id. */
export async function createContact(
  customerId: string,
  details: ContactDetails
): Promise<ApiResponse<{ contactId: string }>> {
  if (!isLiveApiConfigured()) {
    return {
      success: true,
      data: { contactId: String(Math.floor(1000000 + Math.random() * 9000000)) },
      isMock: true,
    };
  }

  const res = await apiClient<any>(
    '/contacts/add.json',
    {
      'customer-id': customerId,
      name: details.name,
      company: details.company || 'N/A',
      email: details.email,
      'address-line-1': details.address,
      city: details.city,
      state: details.state,
      country: details.country,
      zipcode: details.zipcode,
      'phone-cc': details.phoneCc,
      phone: details.phone,
      type: 'Contact',
    },
    'POST'
  );

  if (!res.success) return { success: false, error: res.error };

  // The id comes back bare for this call rather than wrapped.
  const contactId = String((res.data as any)?.contactId ?? res.data ?? '').replace(/"/g, '');
  if (!contactId || contactId === 'undefined') {
    return { success: false, error: 'Upstream did not return a contact id.' };
  }

  return { success: true, data: { contactId } };
}

/**
 * The four ids a domain order needs, reusing an existing contact where one is
 * already on file and creating one otherwise.
 *
 * All four are the same contact. Separating them is only worth doing when a
 * customer genuinely has different administrative and technical parties, which
 * is not the case here.
 */
export async function ensureDomainContacts(
  customerId: string,
  details: ContactDetails
): Promise<{ contacts: DomainContactIds | null; error?: string }> {
  try {
    const existing = await getDefaultContacts(customerId);
    if (existing.success && existing.data) {
      // The payload nests the contact under a type key; take the first id.
      const found = Object.values(existing.data).find(
        (v: any) => v && typeof v === 'object' && (v.contactid || v.contact_id)
      ) as any;
      const id = found ? String(found.contactid ?? found.contact_id) : '';
      if (id) {
        return { contacts: { registrant: id, admin: id, tech: id, billing: id } };
      }
    }
  } catch {
    // Fall through and create one.
  }

  const created = await createContact(customerId, details);
  if (!created.success || !created.data?.contactId) {
    return { contacts: null, error: created.error || 'Could not create a registrant contact.' };
  }

  const id = created.data.contactId;
  return { contacts: { registrant: id, admin: id, tech: id, billing: id } };
}
