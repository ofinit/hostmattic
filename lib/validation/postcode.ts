/**
 * Postcode validation.
 *
 * Deliberately strict for India and deliberately loose everywhere else.
 *
 * An Indian PIN has a fixed, well-known shape, most customers are Indian, and
 * a typo there is worth catching. Postcodes elsewhere vary enormously - UK
 * "SW1A 1AA", Canadian "K1A 0B1", US "10001-1234", Dutch "1012 AB" - and a
 * pattern tight enough to be useful would reject valid foreign ones. Rejecting
 * a real customer's real postcode is a worse failure than accepting a typo, so
 * outside India this only checks that the value is plausible at all.
 *
 * Shared by both checkouts and the checkout API, because this codebase has two
 * checkout implementations and a rule written twice drifts.
 */

export interface PostcodeCheck {
  ok: boolean;
  error?: string;
}

/**
 * Indian PIN: six digits, never starting with zero. The ranges in use begin
 * at 110001 and end at 855117, so a leading zero is always a mistake.
 */
const INDIA_PIN = /^[1-9]\d{5}$/;

/** Letters, digits, spaces and hyphens, three to twelve characters. */
const GENERAL_POSTCODE = /^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/;

export function validatePostcode(value: string, country?: string): PostcodeCheck {
  const trimmed = (value || '').trim();

  if (!trimmed) {
    return { ok: false, error: 'A postcode is required so your services can be registered.' };
  }

  if ((country || '').toUpperCase() === 'IN') {
    // Compare without spaces: "403 517" is a normal way to write it.
    const compact = trimmed.replace(/\s+/g, '');
    if (!INDIA_PIN.test(compact)) {
      return {
        ok: false,
        error: 'An Indian PIN code is six digits and does not start with zero, for example 403517.',
      };
    }
    return { ok: true };
  }

  if (!GENERAL_POSTCODE.test(trimmed)) {
    return {
      ok: false,
      error: 'That does not look like a postal code. Letters, digits, spaces and hyphens only.',
    };
  }

  return { ok: true };
}

/** Normalised for storage: trimmed, and spaces removed for an Indian PIN. */
export function normalisePostcode(value: string, country?: string): string {
  const trimmed = (value || '').trim();
  return (country || '').toUpperCase() === 'IN' ? trimmed.replace(/\s+/g, '') : trimmed;
}
