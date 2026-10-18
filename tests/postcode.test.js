/**
 * Postcode validation.
 *
 * The balance being tested: strict enough that an Indian PIN typo is caught,
 * loose enough that a real foreign postcode is never rejected. Rejecting a
 * genuine customer is the worse failure of the two.
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const { validatePostcode, normalisePostcode } = require(
  path.join(__dirname, '..', '.test-build', 'validation', 'postcode.js')
);

test('a valid Indian PIN is accepted', () => {
  for (const pin of ['403517', '110001', '682001', '855117']) {
    assert.strictEqual(validatePostcode(pin, 'IN').ok, true, `${pin} was rejected`);
  }
});

test('an Indian PIN written with a space is accepted', () => {
  assert.strictEqual(validatePostcode('403 517', 'IN').ok, true);
  assert.strictEqual(normalisePostcode('403 517', 'IN'), '403517');
});

test('a malformed Indian PIN is rejected', () => {
  for (const bad of ['40351', '4035170', '012345', 'ABC123', '40-517']) {
    const result = validatePostcode(bad, 'IN');
    assert.strictEqual(result.ok, false, `${bad} was accepted`);
    assert.match(result.error, /six digits/);
  }
});

test('foreign postcodes are not forced into the Indian shape', () => {
  // Each of these is real and would fail a six-digit rule.
  const valid = [
    ['SW1A 1AA', 'GB'],
    ['K1A 0B1', 'CA'],
    ['10001', 'US'],
    ['10001-1234', 'US'],
    ['1012 AB', 'NL'],
    ['2000', 'AU'],
    ['75008', 'FR'],
  ];
  for (const [code, country] of valid) {
    assert.strictEqual(validatePostcode(code, country).ok, true, `${code} (${country}) was rejected`);
  }
});

test('an empty postcode is rejected whatever the country', () => {
  for (const country of ['IN', 'US', undefined]) {
    assert.strictEqual(validatePostcode('', country).ok, false);
    assert.strictEqual(validatePostcode('   ', country).ok, false);
  }
});

test('obvious rubbish is rejected outside India too', () => {
  for (const bad of ['@@', '!!!!', 'a']) {
    assert.strictEqual(validatePostcode(bad, 'US').ok, false, `${bad} was accepted`);
  }
});

test('a missing country falls back to the permissive rule', () => {
  // An unknown country must not be held to the Indian pattern.
  assert.strictEqual(validatePostcode('SW1A 1AA').ok, true);
  assert.strictEqual(validatePostcode('403517').ok, true);
});
