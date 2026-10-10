// scripts/set-admin-password.js
//
// Deliberately sets the password of the Hostmattic administrator account.
//
// ADMIN_PASSWORD only applies when the admin is first created. Bootstrap no longer
// rewrites an existing admin's password on every login (that reverted real password
// changes and left the committed fallback usable forever), so rotating it afterwards
// is an explicit, one-off operation - this script.
//
// Usage:
//   npm run admin:password -- "NewStrongPassword"
//   npm run admin:password -- "NewStrongPassword" admin@hostmattic.com
//   ADMIN_PASSWORD="NewStrongPassword" npm run admin:password
//
// Add --force to allow the known-insecure committed default.

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Run directly with `node`, nothing loads .env for us (Next does it in the app,
// and Coolify injects real environment variables in production). Read it here so
// DATABASE_URL and ADMIN_* work locally. Existing environment variables win.
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

const COMMITTED_DEFAULT = 'Hostmattic@2026';
const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = argv.slice(2).filter((a) => a !== '--');
  const force = args.includes('--force');
  const positional = args.filter((a) => !a.startsWith('--'));
  return {
    password: positional[0] || process.env.ADMIN_PASSWORD || '',
    email: (positional[1] || process.env.ADMIN_EMAIL || 'admin@hostmattic.com').toLowerCase().trim(),
    force,
  };
}

function validate(password, force) {
  if (!password) {
    return 'No password given. Pass one as an argument or set ADMIN_PASSWORD.';
  }
  if (password === COMMITTED_DEFAULT && !force) {
    return `That password was hardcoded in this repository's history and must be treated as public. Choose another, or pass --force if you genuinely intend to use it.`;
  }
  if (password.length < 12) {
    return `Password is ${password.length} characters; use at least 12. Generate one with: openssl rand -base64 24`;
  }
  return null;
}

async function main() {
  const { password, email, force } = parseArgs(process.argv);

  const problem = validate(password, force);
  if (problem) {
    console.error(`\n  ✗ ${problem}\n`);
    process.exitCode = 1;
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findFirst({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, role: 'ADMIN' },
    });
    console.log(`\n  ✓ Password updated for existing administrator: ${email}\n`);
  } else {
    await prisma.user.create({
      data: {
        email,
        name: 'Hostmattic Administrator',
        passwordHash,
        role: 'ADMIN',
      },
    });
    console.log(`\n  ✓ Administrator created: ${email}\n`);
  }

  console.log('  Sign in at /admin/login');
  console.log('  Keep ADMIN_PASSWORD in the environment in sync so a fresh database seeds the same way.\n');
}

main()
  .catch((err) => {
    console.error('\n  ✗ Could not set the administrator password.');
    console.error(`    ${err && err.message ? err.message : err}`);
    console.error('    Check that DATABASE_URL points at a reachable database.\n');
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await prisma.$disconnect(); } catch {}
  });
