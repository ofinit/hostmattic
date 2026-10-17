/**
 * Invoice numbering.
 *
 * Rule 46(b) of the CGST Rules requires a tax invoice to carry "a consecutive
 * serial number not exceeding sixteen characters, in one or multiple series,
 * containing alphabets or numerals or special characters hyphen or dash and
 * slash... unique for a financial year".
 *
 * Orders previously used:
 *
 *   'HM-' + Date.now().toString().slice(-6) + '-' + Math.floor(100 + Math.random() * 900)
 *
 * which is not consecutive, carries no financial year, and can collide: two
 * orders placed in the same decisecond differ only by a random three-digit
 * number, so roughly one pair in a thousand would share an invoice number.
 *
 * This issues HM/2026-27/0001 — fifteen characters, consecutive within the
 * Indian financial year, allocated under a row lock so concurrent checkouts
 * cannot take the same number.
 */

import { prisma } from '@/lib/prisma';

/** Indian financial year: 1 April to 31 March, written 2026-27. */
export function financialYearOf(date: Date = new Date()): string {
  const year = date.getFullYear();
  // getMonth() is zero-based, so 3 is April.
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatInvoiceNumber(fy: string, serial: number): string {
  // HM/2026-27/0001 is 15 characters; the limit is 16, so this holds to 9999
  // invoices in a year and then grows to 16 at 99999.
  return `HM/${fy}/${String(serial).padStart(4, '0')}`;
}

/**
 * Allocates the next number in this financial year's series.
 *
 * Deliberately has no fallback. If a number cannot be allocated the caller
 * must fail the checkout: an order recorded without a valid invoice number is
 * a document that cannot lawfully be issued, and inventing one is how the
 * previous scheme came to exist.
 */
export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const fy = financialYearOf(now);

  // A single atomic increment. Postgres locks the row for the update, so two
  // checkouts racing for the same series take different numbers.
  const series = await prisma.invoiceSeries.upsert({
    where: { id: fy },
    create: { id: fy, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  return formatInvoiceNumber(fy, series.lastNumber);
}
