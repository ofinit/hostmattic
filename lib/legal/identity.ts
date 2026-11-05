import { prisma } from '@/lib/prisma';

/**
 * Who this business is, for the pages that have to say so.
 *
 * Every fact here is read from somewhere it was deliberately configured -
 * TaxSetting for the statutory identity, the environment for contact details.
 * Nothing is invented.
 *
 * That restraint matters more here than anywhere else in the app. A privacy
 * policy naming an address nobody entered, or a refund page promising a window
 * nobody chose, is not a placeholder: it is a published commitment on behalf
 * of a real company, and a customer can hold it to that. These pages therefore
 * state plainly when something has not been published yet, and point the
 * reader at a human, rather than filling the gap with something plausible.
 */

export interface BusinessIdentity {
  legalName: string | null;
  gstin: string | null;
  pan: string | null;
  /** Registered address as a single rendered block, or null if unconfigured. */
  address: string | null;
  city: string | null;
  state: string | null;

  supportEmail: string | null;
  supportPhone: string | null;
  supportHours: string | null;

  /**
   * Days within which a refundable service may be cancelled, when the
   * business has published one. Null means no window has been set, and the
   * pages must not imply there is one.
   */
  refundWindowDays: number | null;

  siteUrl: string;

  /** Human-readable names of the facts that are not configured. */
  missing: string[];
}

function clean(value: unknown): string | null {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

function envRefundWindow(): number | null {
  const raw = clean(process.env.REFUND_WINDOW_DAYS);
  if (!raw) return null;
  const n = parseInt(raw, 10);
  // A nonsense window is worse than none: "0 days" or "-5 days" on a published
  // policy is a commitment nobody meant to make.
  if (!Number.isFinite(n) || n <= 0 || n > 365) {
    console.warn(`[legal] REFUND_WINDOW_DAYS is "${raw}", which is not a usable number of days. Ignoring it.`);
    return null;
  }
  return n;
}

export async function getBusinessIdentity(): Promise<BusinessIdentity> {
  let row: any = null;
  try {
    row = await prisma.taxSetting.findUnique({ where: { id: 'default_tax_settings' } });
  } catch (err: any) {
    // A database fault must not take the legal pages down - they are the ones
    // a visitor reaches when something has already gone wrong.
    console.warn('[legal] Could not read business settings:', err?.message);
  }

  const addressParts = [clean(row?.registeredAddress), clean(row?.city), clean(row?.state)]
    .filter(Boolean)
    // The stored address already ends in a comma in at least one deployment,
    // which produced ",," when joined naively.
    .map((p) => String(p).replace(/,\s*$/, ''));

  const identity: BusinessIdentity = {
    legalName: clean(row?.legalBusinessName),
    gstin: clean(row?.sellerGstin),
    pan: clean(row?.panNumber),
    address: addressParts.length ? addressParts.join(', ') : null,
    city: clean(row?.city),
    state: clean(row?.state),

    supportEmail: clean(process.env.SUPPORT_EMAIL),
    supportPhone: clean(process.env.SUPPORT_PHONE),
    supportHours: clean(process.env.SUPPORT_HOURS),

    refundWindowDays: envRefundWindow(),

    siteUrl: clean(process.env.NEXT_PUBLIC_APP_URL) || 'https://hostmattic.com',

    missing: [],
  };

  if (!identity.legalName) identity.missing.push('registered business name (admin: Tax & GST Settings)');
  if (!identity.address) identity.missing.push('registered address (admin: Tax & GST Settings)');
  if (!identity.supportEmail) identity.missing.push('support email (environment: SUPPORT_EMAIL)');
  if (!identity.refundWindowDays) identity.missing.push('refund window (environment: REFUND_WINDOW_DAYS)');

  return identity;
}

/** The date these documents were last changed, for the "last updated" line. */
export const POLICY_LAST_UPDATED = '5 November 2026';
