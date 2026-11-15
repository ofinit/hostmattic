/**
 * Resolve a free-text state name to a GST state code.
 *
 * Upstream stores the registrant's state as whatever string was typed when the
 * account was created - "Andhra Pradesh", "AP", "Orissa", "New Delhi". The
 * checkout needs a GST state code, because the place of supply decides whether
 * an invoice carries CGST + SGST or IGST.
 *
 * That makes a wrong answer here a TAX error on a statutory document, not a
 * cosmetic one, which is why this resolver refuses to guess: anything it
 * cannot match confidently returns null and the customer picks from the list
 * themselves. An empty field is a small annoyance; a confidently wrong place
 * of supply is a misfiled return.
 *
 * The trap that prompted this: GST_STATES carries both `28 Andhra Pradesh`
 * (the pre-2014 code, dead since the Telangana bifurcation) and
 * `37 Andhra Pradesh (New)`. A plain name match lands on 28, the deprecated
 * one. Aliases below are consulted BEFORE the table so 'andhra pradesh'
 * resolves to 37.
 *
 * Kept free of path aliases so the test harness can compile it.
 */

import { GST_STATES } from '../constants/gstStates';

/** Lowercase, collapse whitespace, drop punctuation and the '&' spelling. */
function normalise(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Names and abbreviations that the table does not match on its own, or that
 * it matches WRONGLY. Values are GST state codes.
 */
const ALIASES: Record<string, string> = {
  // The bifurcation. 28 is the pre-2014 code and must never be auto-selected.
  'andhra pradesh': '37',
  'andhra pradesh new': '37',
  'andhrapradesh': '37',
  ap: '37',
  telangana: '36',
  telengana: '36',
  ts: '36',
  tg: '36',

  // Renamed states, still typed the old way.
  orissa: '21',
  odisha: '21',
  pondicherry: '34',
  puducherry: '34',
  uttaranchal: '05',
  uttarakhand: '05',

  // Delhi, in its many forms.
  delhi: '07',
  'new delhi': '07',
  'nct of delhi': '07',
  'national capital territory of delhi': '07',

  // The 2020 union territory merger.
  'dadra and nagar haveli': '26',
  'daman and diu': '26',
  'dadra and nagar haveli and daman and diu': '26',

  // Common short forms.
  'jammu and kashmir': '01',
  'j and k': '01',
  'himachal pradesh': '02',
  hp: '02',
  'uttar pradesh': '09',
  up: '09',
  'madhya pradesh': '23',
  mp: '23',
  'west bengal': '19',
  wb: '19',
  'tamil nadu': '33',
  tamilnadu: '33',
  tn: '33',
  maharashtra: '27',
  mh: '27',
  karnataka: '29',
  ka: '29',
  kerala: '32',
  kl: '32',
  gujarat: '24',
  gj: '24',
  rajasthan: '08',
  rj: '08',
  goa: '30',
  ga: '30',
  'andaman and nicobar': '35',
  'andaman and nicobar islands': '35',
};

const VALID_CODES = new Set(GST_STATES.map((s) => s.code));

/**
 * The GST state code for a name, or null when it cannot be determined.
 *
 * Accepts a two-digit code directly, so a caller holding one already can pass
 * it through this without special-casing.
 */
export function gstStateCodeFor(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = String(raw).trim();

  // Already a code.
  if (/^\d{1,2}$/.test(trimmed)) {
    const padded = trimmed.padStart(2, '0');
    return VALID_CODES.has(padded) ? padded : null;
  }

  const key = normalise(trimmed);
  if (!key) return null;

  // Aliases first: the table would resolve 'andhra pradesh' to the dead code.
  if (ALIASES[key]) return ALIASES[key];

  // Exact match on the table's own names.
  for (const s of GST_STATES) {
    if (normalise(s.name) === key) return s.code;
  }

  // Deliberately no fuzzy or prefix matching. "Punjab" and "Punjab Province"
  // are not the same claim, and a near-miss here misfiles a tax return.
  return null;
}

/** The display name for a code, for showing what was resolved. */
export function gstStateNameFor(code: string | null | undefined): string | null {
  if (!code) return null;
  const found = GST_STATES.find((s) => s.code === code);
  return found ? found.name : null;
}
