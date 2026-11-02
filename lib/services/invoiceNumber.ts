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

/** Order references are internal and carry no statutory meaning. */
export function formatOrderNumber(fy: string, serial: number): string {
  return `HMO/${fy}/${String(serial).padStart(4, '0')}`;
}

/**
 * One atomic increment against a named counter. Postgres locks the row for the
 * update, so two checkouts racing for the same series take different numbers.
 */
async function nextSerial(seriesId: string): Promise<number> {
  const series = await prisma.invoiceSeries.upsert({
    where: { id: seriesId },
    create: { id: seriesId, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return series.lastNumber;
}

/**
 * Allocates the next number in this financial year's INVOICE series.
 *
 * Deliberately has no fallback. If a number cannot be allocated the caller
 * must fail rather than invent one: an invoice without a valid serial is a
 * document that cannot lawfully be issued.
 *
 * Call this only when an invoice is actually being issued. It used to be
 * called at checkout, which burned a serial on every abandoned basket and left
 * the series full of gaps.
 */
export async function nextInvoiceNumber(now: Date = new Date()): Promise<string> {
  const fy = financialYearOf(now);
  return formatInvoiceNumber(fy, await nextSerial(fy));
}

/**
 * The reference for an order, allocated at checkout.
 *
 * Kept on its own counter so an unpaid order cannot consume an invoice serial.
 */
export async function nextOrderNumber(now: Date = new Date()): Promise<string> {
  const fy = financialYearOf(now);
  return formatOrderNumber(fy, await nextSerial(`ORD-${fy}`));
}

/**
 * Issues the tax invoice for an order that has been paid.
 *
 * Idempotent: an order that already carries a number keeps it. That matters
 * because three separate gateway routes mark an order paid and each calls
 * this, and because re-issuing a different serial for a supply already
 * invoiced is precisely what the numbering rules forbid.
 *
 * Returns null if the order is not paid or does not exist. Never throws into
 * a payment path: the money has already moved by the time this runs, and
 * failing the callback would leave the customer charged with no record. The
 * failure is logged for an administrator and the backfill script can repair
 * it.
 */
export async function issueInvoiceNumber(orderId: string): Promise<string | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, invoiceNumber: true, paymentStatus: true, createdAt: true },
    });

    if (!order) return null;
    if (order.invoiceNumber) return order.invoiceNumber;
    if (order.paymentStatus !== 'PAID') return null;

    const issuedAt = new Date();
    const invoiceNumber = await nextInvoiceNumber(issuedAt);

    await prisma.order.update({
      where: { id: orderId },
      data: { invoiceNumber, invoiceIssuedAt: issuedAt },
    });

    return invoiceNumber;
  } catch (err: any) {
    console.error(`[invoice] Could not issue a number for order ${orderId}:`, err?.message);
    return null;
  }
}
