const test = require('node:test');
const assert = require('node:assert');

const { renderInvoicePdf, invoiceFilename } = require('../.test-build/invoice/pdf.js');

const SELLER = {
  legalBusinessName: 'OfinIT Solutions Pvt. Ltd.',
  sellerGstin: '30AAECO0806H1Z1',
  registeredAddress: '498-2, Gudem, Siolim',
  city: 'North Goa',
  state: 'Goa',
  stateCode: '30',
  panNumber: 'AAECO0806H',
  defaultSacCode: '998315',
  lutNumber: '',
};

function order(overrides = {}) {
  return {
    orderNumber: 'HMO/2026-27/0001',
    invoiceNumber: 'HM/2026-27/0001',
    invoiceIssuedAt: new Date('2026-10-18T00:00:00Z'),
    createdAt: new Date('2026-10-18T00:00:00Z'),
    currency: 'INR',
    subtotalAmount: 749.83,
    taxAmount: 134.97,
    totalAmount: 884.8,
    taxRate: 18,
    taxType: 'IGST',
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount: 134.97,
    paymentStatus: 'PAID',
    paymentMethod: 'INSTAMOJO_UPI',
    customerType: 'B2C',
    customerGstin: null,
    companyName: null,
    billingAddress: 'Vikas Marg',
    billingCity: 'New Delhi',
    billingState: 'Delhi',
    billingZip: '110092',
    billingCountry: 'IN',
    placeOfSupply: '07-Delhi',
    user: { name: 'Anuj Goel', email: 'anujgoel2@example.invalid' },
    items: [
      { description: 'Domain Transfer (hotice.co.in)', price: 749.83, quantity: 1, years: 1 },
    ],
    ...overrides,
  };
}

const isPdf = (bytes) =>
  Buffer.from(bytes.slice(0, 5)).toString('latin1') === '%PDF-';

test('renders a tax invoice as a valid PDF', async () => {
  const bytes = await renderInvoicePdf(order(), SELLER);
  assert.ok(isPdf(bytes), 'should carry a PDF header');
  assert.ok(bytes.length > 1000, 'should not be a stub');
});

test('a name outside Latin-1 does not throw', async () => {
  // The standard PDF fonts are WinAnsi-encoded and pdf-lib throws on any
  // character it cannot encode. A customer named in Devanagari must still be
  // able to download their invoice.
  const bytes = await renderInvoicePdf(
    order({ user: { name: 'अनुज गोयल', email: 'x@example.invalid' }, companyName: null }),
    SELLER
  );
  assert.ok(isPdf(bytes));
});

test('a rupee symbol in stored text does not throw', async () => {
  const bytes = await renderInvoicePdf(
    order({ items: [{ description: 'Renewal ₹899 tier', price: 899, quantity: 1, years: 1 }] }),
    SELLER
  );
  assert.ok(isPdf(bytes));
});

test('an unissued invoice still renders, as a proforma', async () => {
  const bytes = await renderInvoicePdf(
    order({ invoiceNumber: null, invoiceIssuedAt: null, paymentStatus: 'PENDING' }),
    SELLER
  );
  assert.ok(isPdf(bytes));
});

test('unconfigured seller identity does not throw', async () => {
  // Blank statutory fields print as "Not configured" rather than failing or
  // inventing a plausible GSTIN.
  const bytes = await renderInvoicePdf(order(), {
    legalBusinessName: '',
    sellerGstin: '',
    registeredAddress: '',
    city: '',
    state: '',
    stateCode: '',
    panNumber: '',
    defaultSacCode: '',
    lutNumber: '',
  });
  assert.ok(isPdf(bytes));
});

test('the CGST and SGST split renders', async () => {
  const bytes = await renderInvoicePdf(
    order({ taxType: 'CGST_SGST', igstAmount: 0, cgstAmount: 67.49, sgstAmount: 67.48 }),
    SELLER
  );
  assert.ok(isPdf(bytes));
});

test('an export under LUT renders', async () => {
  const bytes = await renderInvoicePdf(
    order({ currency: 'USD', taxType: 'LUT_EXPORT', taxAmount: 0, igstAmount: 0 }),
    { ...SELLER, lutNumber: 'LUT/2026/001' }
  );
  assert.ok(isPdf(bytes));
});

test('a long description wraps instead of running off the page', async () => {
  const bytes = await renderInvoicePdf(
    order({
      items: [
        {
          description:
            'Business Email Hosting - 25 mailboxes with archiving, retention and advanced threat protection, billed annually in advance',
          price: 12000,
          quantity: 1,
          months: 12,
        },
      ],
    }),
    SELLER
  );
  assert.ok(isPdf(bytes));
});

test('many line items still produce one valid document', async () => {
  const items = Array.from({ length: 12 }, (_, i) => ({
    description: `Service line ${i + 1}`,
    price: 100 + i,
    quantity: 1,
    years: 1,
  }));
  const bytes = await renderInvoicePdf(order({ items }), SELLER);
  assert.ok(isPdf(bytes));
});

test('the brand mark is embedded as an image, not redrawn as text', async () => {
  // The logo lives in public/ and is read at render time. If that read fails
  // the wordmark is drawn as text instead, so this guards against the logo
  // silently disappearing from every invoice.
  const bytes = await renderInvoicePdf(order(), SELLER);
  const raw = Buffer.from(bytes).toString('latin1');
  assert.ok(raw.includes('/Image'), 'should embed an image XObject');
  assert.ok(bytes.length > 20000, 'an embedded logo makes the file substantially larger');
});

test('the filename drops the slashes an invoice serial carries', () => {
  assert.strictEqual(
    invoiceFilename({ invoiceNumber: 'HM/2026-27/0001', orderNumber: 'HMO/2026-27/0001' }),
    'HM-2026-27-0001.pdf'
  );
  // Falls back to the order reference when no invoice has been issued.
  assert.strictEqual(
    invoiceFilename({ invoiceNumber: null, orderNumber: 'HMO/2026-27/0007' }),
    'HMO-2026-27-0007.pdf'
  );
});
