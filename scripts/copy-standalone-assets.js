const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');

if (fs.existsSync(standalone)) {
  // Copy public/ -> .next/standalone/public
  const publicSrc = path.join(root, 'public');
  const publicDest = path.join(standalone, 'public');
  if (fs.existsSync(publicSrc)) {
    fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    console.log('[Hostmattic] Copied public/ to .next/standalone/public');
  }

  // Copy .next/static/ -> .next/standalone/.next/static
  const staticSrc = path.join(root, '.next', 'static');
  const staticDest = path.join(standalone, '.next', 'static');
  if (fs.existsSync(staticSrc)) {
    fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    console.log('[Hostmattic] Copied .next/static to .next/standalone/.next/static');
  }
}
