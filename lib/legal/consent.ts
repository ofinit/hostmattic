/**
 * The consent notice, itemised by purpose.
 *
 * The DPDP Act requires a Data Principal to be told, before or at the point of
 * collection, what personal data is being collected and for what purpose - in
 * clear and plain language, itemised rather than bundled into one blanket
 * agreement. The burden of proving consent sits with the Data Fiduciary, so
 * what the person was shown has to be recorded alongside the fact that they
 * agreed.
 *
 * NOTICE_VERSION is how that works. Every ConsentRecord stores the version in
 * force when it was given, so editing this file changes what NEW users see
 * without rewriting history for anyone who agreed to an earlier wording.
 *
 * Bump NOTICE_VERSION whenever the substance of a purpose changes - not for a
 * typo, but for anything that alters what is collected, why, or who receives
 * it.
 */

export const NOTICE_VERSION = '2026-11-05.1';

export type ConsentPurposeKey = 'account' | 'registrant' | 'service_email' | 'marketing';

export interface ConsentPurpose {
  key: ConsentPurposeKey;
  label: string;
  /** What is collected, in plain words. */
  data: string;
  /** Why it is needed. */
  why: string;
  /** Who else sees it. Empty when nobody does. */
  sharedWith?: string;
  /**
   * False when the service cannot be provided without it. A required purpose
   * is still disclosed and still recorded - the person is agreeing to it by
   * proceeding - but it is not offered as a toggle, because a checkbox that
   * cannot be unticked is a lie about choice.
   */
  optional: boolean;
  /** Where in the journey this is collected. */
  stage: 'signup' | 'checkout';
}

export const CONSENT_PURPOSES: ConsentPurpose[] = [
  {
    key: 'account',
    label: 'Running your account',
    data: 'Your name, email address and password (stored only as a one-way hash).',
    why: 'To create your account, sign you in, and show you the services you hold.',
    optional: false,
    stage: 'signup',
  },
  {
    key: 'service_email',
    label: 'Service messages',
    data: 'Your email address.',
    why:
      'To send order confirmations, invoices, renewal reminders and replies to your tickets. ' +
      'These are not marketing: a missed renewal reminder can cost you a domain.',
    sharedWith: 'Our email delivery provider.',
    optional: false,
    stage: 'signup',
  },
  {
    key: 'registrant',
    label: 'Registering a domain in your name',
    data: 'Your name, postal address, email address and phone number.',
    why:
      'Domain registries require these from the registrant. A domain cannot be registered without ' +
      'them, and they must be accurate - a registry may suspend a domain whose details are false.',
    sharedWith:
      'Our upstream registrar and the registry operating the extension. Some registries publish ' +
      'part of this in a public WHOIS record, and some operate outside India. Where privacy ' +
      'protection is available for an extension and you enable it, your details are masked in that ' +
      'public record - it does not hide them from the registry itself.',
    optional: false,
    stage: 'checkout',
  },
  {
    key: 'marketing',
    label: 'Offers and product news',
    data: 'Your email address.',
    why: 'To tell you about new services, pricing changes and promotions.',
    optional: true,
    stage: 'signup',
  },
];

export function purposesForStage(stage: 'signup' | 'checkout'): ConsentPurpose[] {
  return CONSENT_PURPOSES.filter((p) => p.stage === stage);
}

export function purposeByKey(key: string): ConsentPurpose | undefined {
  return CONSENT_PURPOSES.find((p) => p.key === key);
}

/** The purposes a person may turn off without losing the service. */
export function optionalPurposes(): ConsentPurpose[] {
  return CONSENT_PURPOSES.filter((p) => p.optional);
}

/**
 * Whether a purpose can be withdrawn.
 *
 * Withdrawing consent for a required purpose is not a toggle - it means
 * closing the account, because the service cannot run without it. The portal
 * says that rather than silently refusing.
 */
export function isWithdrawable(key: string): boolean {
  const p = purposeByKey(key);
  return Boolean(p && p.optional);
}
