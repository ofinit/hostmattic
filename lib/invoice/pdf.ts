/**
 * Tax invoice as a PDF.
 *
 * Generated server-side from the order record rather than captured from the
 * rendered page, so the file is identical wherever it is produced, the text is
 * selectable and searchable, and it can be attached to an email later without
 * a browser in the loop.
 *
 * Two deliberate constraints:
 *
 * 1. The standard PDF fonts are WinAnsi-encoded and have no rupee glyph, and
 *    pdf-lib throws on any character it cannot encode. Amounts are written as
 *    "INR 884.80" rather than with a symbol, and every piece of customer-
 *    supplied text goes through `safe()` - a customer whose name is in
 *    Devanagari must not crash the download.
 *
 * 2. An order with no invoice number has not been invoiced. It renders as a
 *    PROFORMA, clearly marked as not a tax invoice, rather than borrowing the
 *    order number and presenting itself as one.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

export interface InvoiceSeller {
  legalBusinessName: string;
  sellerGstin: string;
  registeredAddress: string;
  city: string;
  state: string;
  stateCode: string;
  panNumber: string;
  defaultSacCode: string;
  lutNumber: string;
}

export interface InvoiceOrder {
  orderNumber: string;
  invoiceNumber: string | null;
  invoiceIssuedAt: Date | null;
  createdAt: Date;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  taxRate: number;
  taxType: string | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  paymentStatus: string;
  paymentMethod: string | null;
  customerType: string;
  customerGstin: string | null;
  companyName: string | null;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  billingCountry: string | null;
  placeOfSupply: string | null;
  user?: { name?: string | null; email?: string | null } | null;
  items: Array<{
    description: string;
    price: number;
    quantity?: number | null;
    billingPeriod?: string | null;
    years?: number | null;
    months?: number | null;
  }>;
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 42;

const INK = rgb(0.06, 0.09, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const RULE = rgb(0.80, 0.84, 0.88);
const PAPER_TINT = rgb(0.97, 0.98, 0.99);
const WARN = rgb(0.72, 0.11, 0.11);

/**
 * WinAnsi-safe text. The standard fonts cover Latin-1 and little else, and an
 * unencodable character throws rather than degrading, so anything outside the
 * range is transliterated where there is an obvious equivalent and replaced
 * otherwise.
 */
function safe(value: unknown, fallback = ''): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!raw) return fallback;
  return (
    raw
      .replace(/₹/g, 'INR ')
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/ /g, ' ')
      // Anything still outside Latin-1 cannot be encoded.
      .replace(/[^\x20-\xFF]/g, '?')
      .trim() || fallback
  );
}

/** "INR 884.80" - no symbol, because the standard fonts have no rupee glyph. */
function money(amount: number, currency: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${currency === 'INR' ? 'INR' : 'USD'} ${n.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Greedy wrap to a pixel width, so a long address cannot run off the page. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

/** The term a line item covers, from whichever field carries it. */
function periodOf(item: InvoiceOrder['items'][number]): string {
  if (item.years && item.years > 0) return `${item.years} Year${item.years === 1 ? '' : 's'}`;
  if (item.months && item.months > 0) return `${item.months} Month${item.months === 1 ? '' : 's'}`;
  if (item.billingPeriod) return safe(item.billingPeriod);
  return '-';
}

export async function renderInvoicePdf(
  order: InvoiceOrder,
  seller: InvoiceSeller
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage(A4);
  const { width, height } = page.getSize();
  const right = width - MARGIN;
  const contentWidth = right - MARGIN;
  let y = height - MARGIN;

  const text = (
    value: string,
    x: number,
    yPos: number,
    opts: { size?: number; font?: PDFFont; color?: any } = {}
  ) => {
    page.drawText(value, {
      x,
      y: yPos,
      size: opts.size ?? 9,
      font: opts.font ?? regular,
      color: opts.color ?? INK,
    });
  };

  const textRight = (
    value: string,
    xRight: number,
    yPos: number,
    opts: { size?: number; font?: PDFFont; color?: any } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 9;
    text(value, xRight - font.widthOfTextAtSize(value, size), yPos, opts);
  };

  // An order with no invoice number has not been invoiced. Say so rather than
  // dressing the order number up as a tax invoice serial.
  const issued = Boolean(order.invoiceNumber);
  const docTitle = issued ? 'TAX INVOICE' : 'PROFORMA INVOICE';

  // ---- Masthead ----------------------------------------------------------
  text('HOSTMATTIC', MARGIN, y - 16, { size: 20, font: bold });
  text('Domains, Websites & Hosting', MARGIN, y - 29, { size: 8, color: MUTED });

  const titleWidth = bold.widthOfTextAtSize(docTitle, 10) + 18;
  page.drawRectangle({
    x: right - titleWidth,
    y: y - 20,
    width: titleWidth,
    height: 20,
    color: issued ? INK : WARN,
  });
  textRight(docTitle, right - 9, y - 14, { size: 10, font: bold, color: rgb(1, 1, 1) });

  y -= 44;
  text(
    issued
      ? 'Original for Recipient - Section 31 of the CGST Act, 2017'
      : 'Not a tax invoice. Issued for reference only; no supply has been paid for.',
    MARGIN,
    y,
    { size: 7.5, color: issued ? MUTED : WARN }
  );

  y -= 10;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1.2, color: INK });
  y -= 18;

  // ---- Supplier and recipient -------------------------------------------
  const colGap = 16;
  const colWidth = (contentWidth - colGap) / 2;
  const rightColX = MARGIN + colWidth + colGap;
  const boxTop = y;

  const partyLines = (lines: Array<{ t: string; bold?: boolean; color?: any; size?: number }>, x: number) => {
    let cursor = boxTop - 14;
    for (const line of lines) {
      for (const wrapped of wrap(line.t, line.bold ? bold : regular, line.size ?? 8.5, colWidth - 20)) {
        text(wrapped, x + 10, cursor, {
          size: line.size ?? 8.5,
          font: line.bold ? bold : regular,
          color: line.color ?? INK,
        });
        cursor -= 11;
      }
    }
    return cursor;
  };

  const sellerAddress = [seller.registeredAddress, seller.city].filter(Boolean).map((v) => safe(v)).join(', ');
  const sellerRegion = [
    safe(seller.state),
    seller.stateCode ? `State Code: ${safe(seller.stateCode)}` : '',
  ].filter(Boolean).join(' - ');

  const supplierEnd = partyLines(
    [
      { t: 'SUPPLIER / SERVICE PROVIDER', size: 7, color: MUTED, bold: true },
      { t: safe(seller.legalBusinessName, 'Not configured'), bold: true, size: 10 },
      ...(sellerAddress ? [{ t: sellerAddress, color: MUTED }] : []),
      ...(sellerRegion ? [{ t: sellerRegion, color: MUTED }] : []),
      { t: `GSTIN: ${safe(seller.sellerGstin, 'Not configured')}`, bold: true },
      { t: `PAN: ${safe(seller.panNumber, 'Not configured')}` },
    ],
    MARGIN
  );

  const recipientName = safe(order.companyName || order.user?.name, 'Valued Customer');
  const recipientPlace = [safe(order.billingCity), safe(order.billingState)].filter(Boolean).join(', ');
  const recipientEnd = partyLines(
    [
      { t: 'RECIPIENT / CUSTOMER', size: 7, color: MUTED, bold: true },
      { t: recipientName, bold: true, size: 10 },
      ...(order.billingAddress ? [{ t: safe(order.billingAddress), color: MUTED }] : []),
      ...(recipientPlace
        ? [{ t: `${recipientPlace}${order.billingZip ? ` - ${safe(order.billingZip)}` : ''}`, color: MUTED }]
        : []),
      { t: `Country: ${safe(order.billingCountry, order.currency === 'INR' ? 'IN' : 'US')}`, color: MUTED },
      order.customerGstin
        ? { t: `Buyer GSTIN: ${safe(order.customerGstin)}`, bold: true }
        : { t: 'Status: Unregistered Buyer (B2C)' },
      { t: `Place of Supply: ${safe(order.placeOfSupply, 'Not recorded')}`, bold: true },
    ],
    rightColX
  );

  const boxBottom = Math.min(supplierEnd, recipientEnd) - 6;
  for (const x of [MARGIN, rightColX]) {
    page.drawRectangle({
      x,
      y: boxBottom,
      width: colWidth,
      height: boxTop - boxBottom,
      borderColor: RULE,
      borderWidth: 1,
    });
  }

  y = boxBottom - 20;

  // ---- Meta bar ----------------------------------------------------------
  const metaHeight = 34;
  page.drawRectangle({ x: MARGIN, y: y - metaHeight, width: contentWidth, height: metaHeight, color: INK });

  const issueDate = order.invoiceIssuedAt || order.createdAt;
  const meta: Array<[string, string]> = [
    [issued ? 'Invoice No' : 'Order Ref', safe(order.invoiceNumber || order.orderNumber)],
    [issued ? 'Invoice Date' : 'Order Date', formatDate(issueDate)],
    ['Payment Status', safe(order.paymentStatus, 'UNPAID')],
    ['Mode', safe(order.paymentMethod, 'ONLINE')],
  ];
  meta.forEach(([label, value], i) => {
    const x = MARGIN + 12 + i * (contentWidth / meta.length);
    text(label, x, y - 13, { size: 6.5, color: rgb(0.65, 0.70, 0.78) });
    text(value, x, y - 25, { size: 8.5, font: bold, color: rgb(1, 1, 1) });
  });

  y -= metaHeight + 24;

  // ---- Line items --------------------------------------------------------
  const cols = {
    num: MARGIN,
    desc: MARGIN + 24,
    sac: MARGIN + 300,
    period: MARGIN + 370,
    amount: right,
  };

  text('#', cols.num, y, { size: 7, font: bold, color: MUTED });
  text('DESCRIPTION OF SERVICE', cols.desc, y, { size: 7, font: bold, color: MUTED });
  text('SAC CODE', cols.sac, y, { size: 7, font: bold, color: MUTED });
  text('PERIOD', cols.period, y, { size: 7, font: bold, color: MUTED });
  textRight('TAXABLE AMOUNT', cols.amount, y, { size: 7, font: bold, color: MUTED });

  y -= 8;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.8, color: RULE });
  y -= 16;

  order.items.forEach((item, index) => {
    const descLines = wrap(safe(item.description, 'Service'), regular, 9, cols.sac - cols.desc - 12);
    text(String(index + 1), cols.num, y, { size: 9, color: MUTED });
    descLines.forEach((line, i) => text(line, cols.desc, y - i * 11, { size: 9 }));
    text(safe(seller.defaultSacCode, '998315'), cols.sac, y, { size: 9, color: MUTED });
    text(periodOf(item), cols.period, y, { size: 9, color: MUTED });

    const qty = item.quantity && item.quantity > 1 ? item.quantity : 1;
    textRight(money(item.price * qty, order.currency), cols.amount, y, { size: 9, font: bold });

    y -= Math.max(descLines.length, 1) * 11 + 10;
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: right, y: y + 6 }, thickness: 0.4, color: RULE });
  });

  y -= 10;

  // ---- Totals ------------------------------------------------------------
  const totalsX = MARGIN + contentWidth * 0.48;
  const totalsWidth = right - totalsX;

  const totalRows: Array<[string, string]> = [['Taxable Subtotal', money(order.subtotalAmount, order.currency)]];

  const rate = order.taxRate || 18;
  if (order.taxType === 'LUT_EXPORT') {
    totalRows.push(['Export under LUT - GST 0%', money(0, order.currency)]);
  } else if (order.taxType === 'IGST' || order.igstAmount > 0) {
    totalRows.push([`Integrated Tax (IGST ${rate}%)`, money(order.igstAmount || order.taxAmount, order.currency)]);
  } else if (order.cgstAmount > 0 || order.sgstAmount > 0) {
    totalRows.push([`Central Tax (CGST ${rate / 2}%)`, money(order.cgstAmount, order.currency)]);
    totalRows.push([`State Tax (SGST ${rate / 2}%)`, money(order.sgstAmount, order.currency)]);
  } else if (order.taxAmount > 0) {
    totalRows.push([`Tax (${rate}%)`, money(order.taxAmount, order.currency)]);
  }

  const totalsTop = y;
  page.drawRectangle({
    x: totalsX,
    y: totalsTop - (totalRows.length * 15 + 34),
    width: totalsWidth,
    height: totalRows.length * 15 + 34,
    color: PAPER_TINT,
  });

  let ty = totalsTop - 16;
  for (const [label, value] of totalRows) {
    text(label, totalsX + 12, ty, { size: 8.5, color: MUTED });
    textRight(value, right - 12, ty, { size: 8.5 });
    ty -= 15;
  }

  page.drawLine({
    start: { x: totalsX + 12, y: ty + 6 },
    end: { x: right - 12, y: ty + 6 },
    thickness: 1,
    color: INK,
  });
  ty -= 6;
  text('Total Invoice Amount', totalsX + 12, ty, { size: 10, font: bold });
  textRight(money(order.totalAmount, order.currency), right - 12, ty, { size: 10, font: bold });

  y = ty - 36;

  // ---- Statutory footer --------------------------------------------------
  if (order.taxType === 'LUT_EXPORT') {
    const endorsement = seller.lutNumber
      ? `Supply meant for export under Letter of Undertaking ${safe(seller.lutNumber)} without payment of Integrated Tax.`
      : 'Supply meant for export without payment of Integrated Tax. LUT number not configured.';
    for (const line of wrap(endorsement, regular, 7.5, contentWidth)) {
      text(line, MARGIN, y, { size: 7.5, color: seller.lutNumber ? MUTED : WARN });
      y -= 10;
    }
    y -= 6;
  }

  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.6, color: RULE });
  y -= 14;

  text('Whether tax is payable on reverse charge basis: No', MARGIN, y, { size: 7.5, color: MUTED });
  textRight(`For ${safe(seller.legalBusinessName, 'the supplier')}`, right, y, { size: 8, font: bold });
  y -= 11;
  text('Computer generated official statutory tax invoice. No physical signature required.', MARGIN, y, {
    size: 7.5,
    color: MUTED,
  });
  textRight('Authorized Signatory', right, y - 11, { size: 7.5, color: MUTED });

  return pdf.save();
}

/** `HM/2026-27/0001` is not a safe filename. */
export function invoiceFilename(order: Pick<InvoiceOrder, 'invoiceNumber' | 'orderNumber'>): string {
  const base = (order.invoiceNumber || order.orderNumber || 'invoice').replace(/[^A-Za-z0-9._-]+/g, '-');
  return `${base}.pdf`;
}
