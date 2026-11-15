const test = require('node:test');
const assert = require('node:assert');

const { gstStateCodeFor, gstStateNameFor } = require('../.test-build/customers/stateCode.js');

test('Andhra Pradesh resolves to 37, never the dead code 28', () => {
  // GST_STATES carries both `28 Andhra Pradesh` (pre-2014, dead since the
  // Telangana bifurcation) and `37 Andhra Pradesh (New)`. A plain name match
  // lands on 28 and would print the wrong state code on a tax invoice. This
  // is the exact case that prompted the resolver: the customer is in AP.
  assert.strictEqual(gstStateCodeFor('Andhra Pradesh'), '37');
  assert.strictEqual(gstStateCodeFor('andhra pradesh'), '37');
  assert.strictEqual(gstStateCodeFor('ANDHRA PRADESH'), '37');
  assert.strictEqual(gstStateCodeFor('Andhra Pradesh (New)'), '37');
  assert.strictEqual(gstStateCodeFor('AP'), '37');
});

test('Telangana is its own state, not Andhra Pradesh', () => {
  assert.strictEqual(gstStateCodeFor('Telangana'), '36');
  assert.strictEqual(gstStateCodeFor('telengana'), '36');
});

test('exact table names resolve', () => {
  assert.strictEqual(gstStateCodeFor('Goa'), '30');
  assert.strictEqual(gstStateCodeFor('Karnataka'), '29');
  assert.strictEqual(gstStateCodeFor('West Bengal'), '19');
  assert.strictEqual(gstStateCodeFor('Dadra and Nagar Haveli and Daman and Diu'), '26');
});

test('renamed states still resolve from the old name', () => {
  assert.strictEqual(gstStateCodeFor('Orissa'), '21');
  assert.strictEqual(gstStateCodeFor('Odisha'), '21');
  assert.strictEqual(gstStateCodeFor('Pondicherry'), '34');
  assert.strictEqual(gstStateCodeFor('Uttaranchal'), '05');
});

test('Delhi in its various forms', () => {
  assert.strictEqual(gstStateCodeFor('Delhi'), '07');
  assert.strictEqual(gstStateCodeFor('New Delhi'), '07');
  assert.strictEqual(gstStateCodeFor('NCT of Delhi'), '07');
});

test('punctuation, ampersands and spacing are tolerated', () => {
  assert.strictEqual(gstStateCodeFor('Jammu & Kashmir'), '01');
  assert.strictEqual(gstStateCodeFor('  tamil   nadu  '), '33');
  assert.strictEqual(gstStateCodeFor('Tamil-Nadu'), '33');
});

test('a code passed in comes back validated and padded', () => {
  assert.strictEqual(gstStateCodeFor('30'), '30');
  assert.strictEqual(gstStateCodeFor('7'), '07');
  // 25 is not an allocated GST state code.
  assert.strictEqual(gstStateCodeFor('25'), null);
  assert.strictEqual(gstStateCodeFor('99'), null);
});

test('anything uncertain returns null rather than a guess', () => {
  // A near miss must not resolve: place of supply decides CGST+SGST versus
  // IGST, so a confidently wrong answer misfiles a return. Blank is correct.
  assert.strictEqual(gstStateCodeFor('Punjab Province'), null);
  assert.strictEqual(gstStateCodeFor('Karnat'), null);
  assert.strictEqual(gstStateCodeFor('California'), null);
  assert.strictEqual(gstStateCodeFor('Andhra'), null);
});

test('empty and missing input returns null', () => {
  assert.strictEqual(gstStateCodeFor(''), null);
  assert.strictEqual(gstStateCodeFor(null), null);
  assert.strictEqual(gstStateCodeFor(undefined), null);
  assert.strictEqual(gstStateCodeFor('   '), null);
  assert.strictEqual(gstStateCodeFor('---'), null);
});

test('every alias points at a code the state table actually has', () => {
  // An alias naming a code outside the table would silently fail validation
  // downstream and produce an invoice with no resolvable place of supply.
  const probes = [
    'andhra pradesh', 'telangana', 'orissa', 'pondicherry', 'uttaranchal',
    'delhi', 'new delhi', 'nct of delhi', 'dadra and nagar haveli',
    'jammu and kashmir', 'himachal pradesh', 'uttar pradesh', 'madhya pradesh',
    'west bengal', 'tamil nadu', 'maharashtra', 'karnataka', 'kerala',
    'gujarat', 'rajasthan', 'goa', 'andaman and nicobar',
  ];
  for (const p of probes) {
    const code = gstStateCodeFor(p);
    assert.ok(code, `${p} should resolve`);
    assert.ok(gstStateNameFor(code), `${p} resolved to ${code}, which is not in the table`);
  }
});

test('gstStateNameFor reports what a code resolved to', () => {
  assert.strictEqual(gstStateNameFor('37'), 'Andhra Pradesh (New)');
  assert.strictEqual(gstStateNameFor('30'), 'Goa');
  assert.strictEqual(gstStateNameFor('99'), null);
  assert.strictEqual(gstStateNameFor(null), null);
});
