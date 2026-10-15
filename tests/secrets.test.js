/**
 * Tests for lib/crypto/secrets.ts — the sealing of payment gateway secrets.
 *
 * Run with: npm run test:pricing (builds and runs everything under tests/)
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const BUILD = path.join(__dirname, '..', '.test-build');

// A valid 32-byte key, as hex.
const HEX_KEY = 'a'.repeat(64);

function withKey(value, fn) {
  const previous = process.env.SETTINGS_ENCRYPTION_KEY;
  if (value === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
  else process.env.SETTINGS_ENCRYPTION_KEY = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.SETTINGS_ENCRYPTION_KEY;
    else process.env.SETTINGS_ENCRYPTION_KEY = previous;
  }
}

const secrets = require(path.join(BUILD, 'crypto', 'secrets.js'));

test('a sealed secret opens back to the original', () => {
  withKey(HEX_KEY, () => {
    const plain = 'rzp_live_ABC123secretvalue';
    const sealed = secrets.encryptSecret(plain);
    assert.notStrictEqual(sealed, plain, 'must not store plaintext');
    assert.ok(sealed.startsWith('v1:'), 'should carry a scheme marker');
    assert.strictEqual(secrets.decryptSecret(sealed), plain);
  });
});

test('the same secret seals differently each time', () => {
  withKey(HEX_KEY, () => {
    const a = secrets.encryptSecret('same-value');
    const b = secrets.encryptSecret('same-value');
    assert.notStrictEqual(a, b, 'a fresh IV must be used per encryption');
    assert.strictEqual(secrets.decryptSecret(a), secrets.decryptSecret(b));
  });
});

test('a tampered ciphertext is rejected, not silently mangled', () => {
  withKey(HEX_KEY, () => {
    const sealed = secrets.encryptSecret('rzp_live_tamper_me');
    const parts = sealed.split(':');
    // Flip a byte in the ciphertext.
    const data = Buffer.from(parts[3], 'base64');
    data[0] = data[0] ^ 0xff;
    parts[3] = data.toString('base64');

    assert.throws(
      () => secrets.decryptSecret(parts.join(':')),
      'GCM authentication must fail rather than return rubbish'
    );
  });
});

test('a secret sealed under one key cannot be opened with another', () => {
  const sealed = withKey(HEX_KEY, () => secrets.encryptSecret('rzp_live_wrong_key'));
  withKey('b'.repeat(64), () => {
    assert.throws(() => secrets.decryptSecret(sealed));
  });
});

test('fails closed when no key-encryption-key is configured', () => {
  withKey(undefined, () => {
    assert.strictEqual(secrets.isEncryptionAvailable(), false);
    assert.throws(() => secrets.encryptSecret('anything'), /SETTINGS_ENCRYPTION_KEY/);
    assert.throws(() => secrets.decryptSecret('v1:a:b:c'), /SETTINGS_ENCRYPTION_KEY/);
  });
});

test('rejects a key that is not 32 bytes rather than padding it', () => {
  withKey('too-short', () => {
    assert.strictEqual(secrets.isEncryptionAvailable(), false);
    assert.throws(() => secrets.encryptSecret('anything'), /32 bytes/);
  });
});

test('accepts hex, base64 and raw 32-character keys', () => {
  const plain = 'gateway-secret';
  for (const key of [
    HEX_KEY,
    Buffer.alloc(32, 7).toString('base64'),
    'c'.repeat(32),
  ]) {
    withKey(key, () => {
      assert.strictEqual(secrets.isEncryptionAvailable(), true, `key rejected: ${key.slice(0, 8)}…`);
      assert.strictEqual(secrets.decryptSecret(secrets.encryptSecret(plain)), plain);
    });
  }
});

test('refuses to seal an empty secret', () => {
  withKey(HEX_KEY, () => {
    assert.throws(() => secrets.encryptSecret(''), /empty/i);
  });
});

test('a malformed sealed value is rejected', () => {
  withKey(HEX_KEY, () => {
    assert.throws(() => secrets.decryptSecret('not-sealed'), /v1 format/);
    assert.throws(() => secrets.decryptSecret('v2:a:b:c'), /v1 format/);
  });
});

test('last4 reveals nothing for a short secret', () => {
  assert.strictEqual(secrets.secretLast4('rzp_live_abcd1234'), '1234');
  assert.strictEqual(secrets.secretLast4('short'), '', 'must not expose most of a short value');
  assert.strictEqual(secrets.secretLast4(''), '');
});
