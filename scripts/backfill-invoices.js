// scripts/backfill-invoices.js
//
// Gives every already-paid order a tax invoice number.
//
// Invoice numbers used to be the order number, allocated at checkout. Orders
// placed before the split therefore have no `invoiceNumber` at all, and their
// invoices render without one. This assigns them.
//
// Two rules govern what each order gets:
//
//   1. If the order number is ALREADY in the invoice format (HM/2026-27/0001),
//      it is adopted as the invoice number unchanged. The customer has been
//      given a document bearing that number; re-issuing the same supply under
//      a different serial is exactly what the numbering rules forbid.
//
//   2. Otherwise a fresh number is allocated from that order's financial-year
//      series, in order of payment date, so the series stays consecutive.
//
// Unpaid orders are skipped. An invoice is issued when a supply is paid for,
// and numbering an unpaid order would put a gap in the series the moment it
// was abandoned.
//
// Usage:
//   npm run invoices:backfill              show what would change
//   npm run invoices:backfill -- --confirm apply it

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Run directly with `node`, nothing loads .env for us.
function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadDotEnv();

const prisma = new PrismaClient();
const confirmed = process.argv.includes('--confirm');

/** Indian financial year: 1 April to 31 March, written 2026-27. */
function financialYearOf(date) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

const format = (fy, serial) => `HM/${fy}/${String(serial).padStart(4, '0')}`;

/** An order number that is already a well-formed invoice serial. */
const ISSUED_FORM = /^HM\/(\d{4}-\d{2})\/(\d{1,5})$/;

async function main() {
  const orders = await prisma.order.findMany({
    where: { paymentStatus: 'PAID', invoiceNumber: null },
    select: { id: true, orderNumber: true, createdAt: true, totalAmount: true, currency: true },
    orderBy: { createdAt: 'asc' },
  });

  const skipped = await prisma.order.count({
    where: { paymentStatus: { not: 'PAID' }, invoiceNumber: null },
  });

  if (!orders.length) {
    console.log(`\nNo paid orders are missing an invoice number.`);
    if (skipped) {
      console.log(`${skipped} unpaid order(s) left alone - they are numbered when they are paid.\n`);
    }
    return;
  }

  // Highest serial already in use per financial year, so fresh numbers
  // continue the series rather than colliding with it.
  const highest = new Map();
  const existing = await prisma.order.findMany({
    where: { invoiceNumber: { not: null } },
    select: { invoiceNumber: true },
  });
  for (const row of existing) {
    const m = ISSUED_FORM.exec(row.invoiceNumber || '');
    if (!m) continue;
    const [, fy, serial] = m;
    highest.set(fy, Math.max(highest.get(fy) || 0, Number(serial)));
  }

  const plan = [];
  for (const order of orders) {
    const adopted = ISSUED_FORM.exec(order.orderNumber);
    if (adopted) {
      const [, fy, serial] = adopted;
      highest.set(fy, Math.max(highest.get(fy) || 0, Number(serial)));
      plan.push({ order, invoiceNumber: order.orderNumber, how: 'adopted from the order number' });
      continue;
    }
    const fy = financialYearOf(order.createdAt);
    const next = (highest.get(fy) || 0) + 1;
    highest.set(fy, next);
    plan.push({ order, invoiceNumber: format(fy, next), how: 'newly allocated' });
  }

  console.log(`\n${plan.length} paid order(s) need an invoice number:\n`);
  for (const { order, invoiceNumber, how } of plan) {
    const money = `${order.currency === 'INR' ? 'Rs' : '$'}${order.totalAmount.toFixed(2)}`;
    console.log(`  ${order.orderNumber.padEnd(18)} ${order.createdAt.toISOString().slice(0, 10)}  ${money.padStart(12)}`);
    console.log(`    -> ${invoiceNumber}  (${how})`);
  }
  if (skipped) {
    console.log(`\n${skipped} unpaid order(s) left alone - they are numbered when they are paid.`);
  }

  if (!confirmed) {
    console.log('\nNothing changed. Re-run with --confirm to apply.\n');
    return;
  }

  for (const { order, invoiceNumber } of plan) {
    await prisma.order.update({
      where: { id: order.id },
      // The issue date is the payment date as far as this record knows; using
      // today's date would claim the invoice was raised long after the supply.
      data: { invoiceNumber, invoiceIssuedAt: order.createdAt },
    });
  }

  // Move each series counter past what is now in use, so the next live
  // allocation cannot hand out a number this backfill just assigned.
  for (const [fy, lastNumber] of highest.entries()) {
    await prisma.invoiceSeries.upsert({
      where: { id: fy },
      create: { id: fy, lastNumber },
      update: { lastNumber: { set: lastNumber } },
    });
    console.log(`Series ${fy} now stands at ${lastNumber}.`);
  }

  console.log(`\nApplied to ${plan.length} order(s).\n`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
