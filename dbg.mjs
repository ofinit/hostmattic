import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://hostmattic.com/domains/transfer', { waitUntil: 'networkidle' });

const log = async (label) => {
  const sel = p.locator('select');
  if (await sel.count() < 2) { console.log(label, '(no drawer yet)'); return; }
  console.log(label, 'country=', await sel.nth(0).inputValue(), 'state=', JSON.stringify(await sel.nth(1).inputValue()));
};

await p.getByRole('button', { name: /INR \(₹\)/ }).click();
const i = p.getByRole('textbox');
await i.nth(0).fill('hotice.co.in');
await i.nth(1).fill('TEST-EPP-0000');
await p.waitForTimeout(2500);
await p.getByRole('button', { name: /Transfer for \$/ }).click();

await p.waitForTimeout(600);  await log('t=0.6s ');
await p.waitForTimeout(1500); await log('t=2.1s ');
await p.waitForTimeout(2500); await log('t=4.6s ');

const body = await p.locator('body').innerText();
console.log('notice present:', /Select your state to complete/i.test(body));
console.log('supply line   :', (body.match(/📍 Supply:[^\n]*/) || ['(none)'])[0]);
await b.close();
