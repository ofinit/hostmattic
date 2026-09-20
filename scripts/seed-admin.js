// scripts/seed-admin.js - Automatically ensures an initial ADMIN account exists in the database
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount === 0) {
      const email = (process.env.ADMIN_EMAIL || 'admin@hostmattic.com').toLowerCase().trim();
      const password = process.env.ADMIN_PASSWORD || 'Hostmattic@2026';
      const passwordHash = await bcrypt.hash(password, 12);

      await prisma.user.upsert({
        where: { email },
        update: { role: 'ADMIN' },
        create: {
          email,
          name: 'Hostmattic Administrator',
          passwordHash,
          role: 'ADMIN',
        },
      });
      console.log(`[Hostmattic] Successfully initialized admin user: ${email}`);
    } else {
      console.log('[Hostmattic] Admin account verified in database.');
    }
  } catch (err) {
    console.warn('[Hostmattic] Note: Admin seed check skipped or database unreachable at this stage.');
  } finally {
    try {
      await prisma.$disconnect();
    } catch {}
  }
}

// Export for programmatic use or run directly
module.exports = seedAdmin;

if (require.main === module) {
  seedAdmin();
}
