const { execSync } = require('child_process');

try {
  console.log('[Hostmattic] Syncing database schema with Prisma...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
  console.log('[Hostmattic] Database schema successfully synchronized.');
} catch (error) {
  console.warn('[Hostmattic] Note: Database not reachable at build time. Schema sync will occur on database connection.');
}
