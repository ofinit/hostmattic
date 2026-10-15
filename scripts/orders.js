// scripts/orders.js
//
// Inspect, void or delete orders that were never actually paid for.
//
// Checkout used to provision and invoice before any payment was attempted, and
// the Order model still defaults paymentStatus to "PAID", so records exist that
// show as settled although no money ever moved. This finds them and lets one be
// removed deliberately, after it has been looked at.
//
// Usage:
//   npm run orders:audit                              list suspect orders
//   npm run orders -- --show HM-002574-943            print one order in full
//   npm run orders -- --void HM-002574-943 --confirm  mark it CANCELLED / FAILED
//   npm run orders -- --delete HM-002574-943 --confirm   remove it entirely
//
// Nothing is changed without --confirm. Voiding keeps the record and the audit
// trail; deleting removes the order and its line items.

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

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1] || true;
};
const has = (name) => argv.includes(name);

const money = (o) => `${o.currency === 'INR' ? '₹' : '$'}${o.totalAmount.toFixed(2)}`;

/** A payment id that upstream never issued. */
function isSimulated(order) {
  const id = order.gatewayPaymentId || '';
  return id.startsWith('pay_sim_') || id.startsWith('order_sim_');
}

/** Settled on paper with nothing from a gateway to back it up. */
function isUnbacked(order) {
  return order.paymentStatus === 'PAID' && (!order.gatewayPaymentId || isSimulated(order));
}

function describe(order) {
  const lines = [
    `  Order        ${order.orderNumber}`,
    `  Customer     ${order.user?.name || 'unknown'} <${order.user?.email || 'unknown'}>`,
    `  Placed       ${order.createdAt.toISOString()}`,
    `  Amount       ${money(order)}  (tax ${order.taxAmount.toFixed(2)})`,
    `  Payment      ${order.paymentStatus} via ${order.paymentMethod}`,
    `  Status       ${order.status}`,
    `  Gateway      ${order.gatewayName || 'none'}`,
    `  Payment id   ${order.gatewayPaymentId || 'NONE - no payment was ever taken'}`,
    `  Signature    ${order.gatewaySignature ? 'present' : 'NONE'}`,
  ];
  for (const it of order.items || []) {
    lines.push(`  Item         ${it.description} — ${it.price} (${it.billingPeriod})`);
  }
  return lines.join('\n');
}

async function findOrder(orderNumber) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { user: { select: { name: true, email: true } }, items: true },
  });
  if (!order) {
    console.error(`No order found with number ${orderNumber}.`);
    process.exit(1);
  }
  return order;
}

async function main() {
  const showNumber = flag('--show');
  const voidNumber = flag('--void');
  const deleteNumber = flag('--delete');
  const confirmed = has('--confirm');

  if (typeof showNumber === 'string') {
    const order = await findOrder(showNumber);
    console.log('\n' + describe(order) + '\n');
    return;
  }

  if (typeof voidNumber === 'string' || typeof deleteNumber === 'string') {
    const target = typeof voidNumber === 'string' ? voidNumber : deleteNumber;
    const order = await findOrder(target);

    console.log('\n' + describe(order) + '\n');

    if (order.gatewayPaymentId && !isSimulated(order)) {
      console.error(
        'REFUSING: this order carries a real gateway payment id, so money may\n' +
          'genuinely have been collected. Refund it through the gateway instead,\n' +
          'or re-run with --force once you have confirmed otherwise.'
      );
      if (!has('--force')) process.exit(1);
    }

    if (!confirmed) {
      console.log('Nothing changed. Re-run with --confirm to proceed.');
      return;
    }

    if (typeof voidNumber === 'string') {
      await prisma.order.update({
        where: { orderNumber: target },
        data: { paymentStatus: 'FAILED', status: 'CANCELLED' },
      });
      console.log(`Voided ${target}: payment FAILED, status CANCELLED. Record kept.`);
    } else {
      await prisma.order.delete({ where: { orderNumber: target } });
      console.log(`Deleted ${target} and its line items.`);
    }
    return;
  }

  // Default: audit.
  const orders = await prisma.order.findMany({
    include: { user: { select: { name: true, email: true } }, items: true },
    orderBy: { createdAt: 'desc' },
  });

  const suspect = orders.filter(isUnbacked);

  console.log(`\n${orders.length} order(s) total; ${suspect.length} marked PAID with no gateway payment behind them.\n`);
  for (const o of suspect) {
    console.log(describe(o));
    console.log('  ' + '-'.repeat(60));
  }
  if (suspect.length) {
    console.log('\nRemove one with:');
    console.log('  npm run orders -- --delete <orderNumber> --confirm');
    console.log('Or keep the record and mark it cancelled:');
    console.log('  npm run orders -- --void <orderNumber> --confirm\n');
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
