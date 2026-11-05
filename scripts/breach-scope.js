// scripts/breach-scope.js
//
// Who has to be told.
//
// The DPDP Act requires a Data Fiduciary to notify the Data Protection Board
// AND each affected Data Principal when a personal data breach occurs. That
// obligation is impossible to meet in the time available if the first step is
// working out who was affected, so this does that step: it turns a scope
// ("accounts created in this window", "these domains", "everyone") into the
// actual list of people, what data of theirs was involved, and a CSV to work
// from.
//
// It is READ ONLY. It changes nothing and sends nothing - deciding to notify
// is a judgement, and the notification itself goes out under a human's name.
//
// Usage:
//   node scripts/breach-scope.js --all
//   node scripts/breach-scope.js --since 2026-10-01 --until 2026-11-05
//   node scripts/breach-scope.js --domains example.in,other.co.in
//   node scripts/breach-scope.js --users a@b.com,c@d.com
//   ... add --csv <path> to write the list out
//
// See docs/BREACH-RUNBOOK.md for what to do with the output.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadDotEnv();

const prisma = new PrismaClient();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1] || null;
}
const flag = (name) => process.argv.includes(`--${name}`);

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const since = arg('since');
  const until = arg('until');
  const domains = (arg('domains') || '').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  const users = (arg('users') || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const all = flag('all');

  if (!all && !since && !domains.length && !users.length) {
    console.error(
      'Name a scope. Notifying everybody when a subset was affected is its own harm:\n' +
      '  --all | --since <date> [--until <date>] | --domains a.in,b.in | --users a@b.com\n'
    );
    process.exit(1);
  }

  const where = {};
  if (!all) {
    const or = [];
    if (since) {
      const createdAt = { gte: new Date(since) };
      if (until) createdAt.lte = new Date(until);
      or.push({ createdAt });
    }
    if (domains.length) or.push({ domains: { some: { domainName: { in: domains } } } });
    if (users.length) or.push({ email: { in: users } });
    if (or.length) where.OR = or;
  }

  const affected = await prisma.user.findMany({
    where,
    select: {
      id: true, email: true, name: true, phone: true, address: true,
      city: true, state: true, country: true, company: true,
      createdAt: true, emailStatus: true,
      domains: { select: { domainName: true, status: true } },
      hostingAccounts: { select: { domainName: true, status: true } },
      orders: { select: { id: true, orderNumber: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (!affected.length) {
    console.log('\nNo accounts match that scope.\n');
    return;
  }

  // What categories of personal data these people have with us at all. The
  // notification has to say what was involved, and that starts from what
  // exists.
  let withRegistrant = 0;
  let withBilling = 0;
  let undeliverable = 0;

  console.log(`\n${affected.length} data principal(s) in scope:\n`);
  for (const u of affected) {
    const hasRegistrant = u.domains.length > 0;
    const hasBilling = Boolean(u.address || u.phone);
    if (hasRegistrant) withRegistrant++;
    if (hasBilling) withBilling++;
    if (u.emailStatus !== 'OK') undeliverable++;

    const categories = [
      'account (name, email)',
      hasBilling ? 'billing (address, phone)' : null,
      hasRegistrant ? `registrant details for ${u.domains.length} domain(s)` : null,
      u.orders.length ? `${u.orders.length} order/invoice record(s)` : null,
    ].filter(Boolean);

    console.log(`  ${u.email}`);
    console.log(`     ${u.name}${u.company ? ` (${u.company})` : ''}`);
    console.log(`     data held: ${categories.join('; ')}`);
    if (u.emailStatus !== 'OK') {
      console.log(`     !! email is ${u.emailStatus} - this person CANNOT be reached by email`);
    }
  }

  console.log('\n--- summary ---');
  console.log(`  data principals:              ${affected.length}`);
  console.log(`  holding registrant details:   ${withRegistrant}`);
  console.log(`  holding billing details:      ${withBilling}`);
  console.log(`  unreachable by email:         ${undeliverable}`);
  if (undeliverable > 0) {
    console.log(
      '\n  Those addresses have previously bounced or complained. Notification by email\n' +
      '  will not reach them, and the duty to inform is not discharged by sending to a\n' +
      '  dead address. Use the phone number on the account, or post.'
    );
  }

  const csvPath = arg('csv');
  if (csvPath) {
    const header = ['email', 'name', 'company', 'phone', 'city', 'state', 'country', 'domains', 'orders', 'emailStatus'];
    const rows = affected.map((u) => [
      u.email, u.name, u.company || '', u.phone || '', u.city || '', u.state || '',
      u.country || '', u.domains.map((d) => d.domainName).join(' '), u.orders.length, u.emailStatus,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    fs.writeFileSync(csvPath, csv, 'utf8');
    console.log(`\n  Written to ${csvPath}`);
    console.log('  This file is itself personal data. Handle and delete it accordingly.\n');
  } else {
    console.log('\n  Add --csv <path> to write this out.\n');
  }
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
