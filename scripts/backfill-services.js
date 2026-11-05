// scripts/backfill-services.js
//
// Creates the missing Domain / HostingAccount rows for order lines that were
// already delivered upstream.
//
// Provisioning used to update the OrderItem and stop there. The customer
// portal lists services, not order lines, so a domain could be registered at
// the registry, invoiced, and still show "Active Domains: 0" to the person who
// paid for it. Fulfilment now records the service as it provisions, and
// repairs the record on retry - but orders already marked PROVISIONED before
// that change are still missing their rows. This writes them.
//
// What it will NOT do:
//
//   * touch upstream. Nothing here registers, transfers or renews anything,
//     and it spends no reseller balance. It only writes local rows for work
//     the provider has already done.
//   * claim a domain that belongs to someone else. If a Domain row exists
//     under a different customer the conflict is reported and skipped, never
//     reassigned.
//   * call a transfer ACTIVE. A transfer-in is lodged, not finished, so it is
//     recorded PENDING and the real state is confirmed upstream.
//
// Dates are anchored to when the line was actually provisioned, not to now,
// so an expiry backfilled today is not pushed a year into the future.
//
// Usage:
//   npm run services:backfill              show what would change
//   npm run services:backfill -- --confirm apply it

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
const CONFIRM = process.argv.includes('--confirm');

function addYears(from, years) {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addMonths(from, months) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

async function main() {
  const items = await prisma.orderItem.findMany({
    where: { provisionStatus: 'PROVISIONED' },
    include: {
      order: {
        select: { id: true, orderNumber: true, userId: true, paymentStatus: true, createdAt: true },
      },
    },
    orderBy: { provisionedAt: 'asc' },
  });

  const plan = [];
  const skipped = [];

  for (const item of items) {
    const domainName = (item.domainName || '').trim().toLowerCase();
    if (!domainName) continue;

    const order = item.order;
    if (!order) continue;

    // A line can only be provisioned against a paid order, but a line marked
    // PROVISIONED on an unpaid order is a data fault, not something to
    // materialise into a live service.
    if (order.paymentStatus !== 'PAID') {
      skipped.push(`${domainName} - order ${order.orderNumber} is ${order.paymentStatus}, not PAID`);
      continue;
    }

    const anchor = item.provisionedAt || order.createdAt || new Date();
    const isHosting = Boolean(item.planId);

    if (isHosting) {
      const existing = await prisma.hostingAccount.findFirst({
        where: { domainName },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId === order.userId) continue;
      if (existing) {
        skipped.push(`${domainName} - a hosting account already exists under a different customer`);
        continue;
      }

      const months = item.months && item.months > 0 ? item.months : 12;
      plan.push({
        kind: 'hosting',
        domainName,
        orderNumber: order.orderNumber,
        userId: order.userId,
        data: {
          userId: order.userId,
          domainName,
          productType: item.productType || 'SHARED_LINUX',
          planName: item.description,
          status: 'ACTIVE',
          billingCycle: months === 1 ? 'MONTHLY' : 'ANNUAL',
          nextDueDate: addMonths(anchor, months),
          upstreamOrderId: item.upstreamOrderId || null,
          createdAt: anchor,
        },
      });
      continue;
    }

    const existing = await prisma.domain.findUnique({
      where: { domainName },
      select: { id: true, userId: true },
    });
    if (existing && existing.userId === order.userId) continue;
    if (existing) {
      skipped.push(`${domainName} - a domain row already exists under a different customer`);
      continue;
    }

    const years = item.years && item.years > 0 ? item.years : 1;
    const transferring = /transfer/i.test(item.description || '');
    const dot = domainName.indexOf('.');

    plan.push({
      kind: 'domain',
      domainName,
      orderNumber: order.orderNumber,
      userId: order.userId,
      data: {
        userId: order.userId,
        domainName,
        tld: dot === -1 ? '' : domainName.slice(dot + 1),
        // Lodged is not completed. The losing registrar has up to five days,
        // so a transfer is PENDING until upstream says otherwise.
        status: transferring ? 'PENDING' : 'ACTIVE',
        registrationDate: anchor,
        expiryDate: addYears(anchor, years),
        autoRenew: true,
        privacyEnabled: false,
        // Unknown for a historical line. Left null rather than guessed: the
        // old guess named hostnames that resolve for nobody.
        nameservers: null,
        upstreamOrderId: item.upstreamOrderId || null,
        createdAt: anchor,
      },
    });
  }

  if (skipped.length) {
    console.log('\nSkipped:');
    for (const s of skipped) console.log(`  ! ${s}`);
  }

  if (!plan.length) {
    console.log('\nEvery provisioned line already has its service record. Nothing to do.\n');
    return;
  }

  console.log(`\n${plan.length} provisioned line(s) have no service record:\n`);
  for (const p of plan) {
    const when = p.kind === 'domain' ? p.data.expiryDate : p.data.nextDueDate;
    console.log(
      `  ${p.kind.padEnd(7)} ${p.domainName.padEnd(32)} ${p.orderNumber.padEnd(18)} ` +
        `${p.kind === 'domain' ? p.data.status : 'ACTIVE'} until ${when.toISOString().slice(0, 10)}`
    );
  }

  if (!CONFIRM) {
    console.log('\nDry run. Nothing was written. Re-run with --confirm to apply.\n');
    return;
  }

  for (const p of plan) {
    if (p.kind === 'hosting') {
      await prisma.hostingAccount.create({ data: p.data });
    } else {
      await prisma.domain.create({ data: p.data });
    }
    console.log(`  recorded ${p.domainName}`);
  }

  console.log(`\nApplied to ${plan.length} service(s).\n`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
