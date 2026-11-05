/**
 * How long each kind of record is kept, and on what authority.
 *
 * The DPDP Act requires personal data to be erased once the purpose it was
 * collected for is served and consent is withdrawn - UNLESS a law requires it
 * to be retained. That exception is doing a lot of work for a business taking
 * payments, so "how long" is not a preference here: most of these periods are
 * set by someone else, and the reason is recorded next to each one.
 *
 * This module is the single statement of that policy. It is deliberately data
 * rather than prose, so an erasure request can be answered against the same
 * rules the business publishes, instead of someone deciding case by case.
 *
 * Nothing here deletes anything on its own. Automatic deletion of financial
 * records is a far more dangerous default than keeping them a little too long,
 * and an erasure that runs unattended cannot be reviewed before it is
 * irreversible.
 */

export type RetentionBasis =
  /** Required by statute; we have no discretion. */
  | 'legal'
  /** Needed while the service exists. */
  | 'contractual'
  /** Held on consent alone - erasable on request. */
  | 'consent';

export interface RetentionRule {
  record: string;
  /** Null where the period is open-ended for as long as the service lasts. */
  keepForYears: number | null;
  basis: RetentionBasis;
  /** Why, in terms a customer would accept as an answer. */
  reason: string;
  /** Whether an erasure request can remove this. */
  erasable: boolean;
}

export const RETENTION_SCHEDULE: RetentionRule[] = [
  {
    record: 'Tax invoices and order records',
    keepForYears: 8,
    basis: 'legal',
    reason:
      'Indian tax law requires books of account and the records supporting them to be preserved ' +
      'for a period measured from the end of the relevant financial year. An invoice is the ' +
      'evidence for a GST return already filed, so deleting it would leave a filed return ' +
      'unsupported.',
    erasable: false,
  },
  {
    record: 'Domain registrant details',
    keepForYears: null,
    basis: 'contractual',
    reason:
      'Held for as long as the domain is registered. These sit with the registry, not only with ' +
      'us: a registry will not withdraw them while the domain exists, and a domain whose details ' +
      'are removed can be suspended.',
    erasable: false,
  },
  {
    record: 'Hosting account and service records',
    keepForYears: null,
    basis: 'contractual',
    reason: 'Held while the service is active, and for the tax period afterwards as part of the order record.',
    erasable: false,
  },
  {
    record: 'Account profile (name, email, address, phone)',
    keepForYears: null,
    basis: 'contractual',
    reason:
      'Needed to operate the account. Erasable once no service is active and the tax period for ' +
      'the last order has passed.',
    erasable: true,
  },
  {
    record: 'Support tickets and replies',
    keepForYears: 3,
    basis: 'contractual',
    reason: 'Kept so the history of an issue stays available to both sides, then removed.',
    erasable: true,
  },
  {
    record: 'Consent records',
    keepForYears: 8,
    basis: 'legal',
    reason:
      'The evidence that processing was lawful while it ran. Deleting a consent record on an ' +
      'erasure request would destroy the only proof that the data had been handled lawfully - ' +
      'which is why a withdrawal sets a date on the record rather than removing it.',
    erasable: false,
  },
  {
    record: 'Marketing contact permission',
    keepForYears: null,
    basis: 'consent',
    reason: 'Held on consent alone. Withdrawn at any time from the control panel, with immediate effect.',
    erasable: true,
  },
  {
    record: 'Server and access logs',
    keepForYears: 1,
    basis: 'contractual',
    reason: 'Kept to investigate faults and abuse, then discarded.',
    erasable: true,
  },
];

/** The records an erasure request can actually remove. */
export function erasableRecords(): RetentionRule[] {
  return RETENTION_SCHEDULE.filter((r) => r.erasable);
}

/**
 * The records that must be kept, with the reason.
 *
 * This is what a refusal should quote. "We cannot delete that" is not an
 * answer; naming the obligation is.
 */
export function retainedRecords(): RetentionRule[] {
  return RETENTION_SCHEDULE.filter((r) => !r.erasable);
}
