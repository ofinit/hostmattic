/**
 * Encryption for secrets held in the database.
 *
 * Payment gateway secrets are configured from the admin console and stored in
 * Postgres. Storing them as plaintext would mean a database dump, a leaked
 * backup or one SQL injection hands over working payment credentials, so they
 * are sealed with AES-256-GCM under a key-encryption-key held in the
 * environment as SETTINGS_ENCRYPTION_KEY.
 *
 * This does not remove the need for environment configuration - it replaces
 * several secrets with one. What it buys is that the database alone is not
 * enough to take payments as you, and that a gateway key can be rotated from
 * the admin screen without a redeploy.
 *
 * Everything here fails closed. Without a usable key-encryption-key nothing is
 * encrypted or decrypted, and the caller is expected to treat the gateway as
 * unconfigured rather than fall back to anything weaker.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SCHEME = 'v1';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class SecretEncryptionUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretEncryptionUnavailable';
  }
}

/**
 * Accepts the key as 64 hex characters, as base64, or as 32 raw characters.
 * Anything that does not yield exactly 32 bytes is rejected rather than padded
 * or hashed into shape, because silently accepting a short key would make the
 * encryption look fine while being far weaker than it claims.
 */
function loadKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new SecretEncryptionUnavailable(
      'SETTINGS_ENCRYPTION_KEY is not set, so stored secrets cannot be read or written.'
    );
  }

  let key: Buffer | null = null;

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else if (/^[A-Za-z0-9+/]+={0,2}$/.test(raw) && Buffer.from(raw, 'base64').length === KEY_BYTES) {
    key = Buffer.from(raw, 'base64');
  } else if (Buffer.byteLength(raw, 'utf8') === KEY_BYTES) {
    key = Buffer.from(raw, 'utf8');
  }

  if (!key || key.length !== KEY_BYTES) {
    throw new SecretEncryptionUnavailable(
      'SETTINGS_ENCRYPTION_KEY must be 32 bytes: 64 hex characters, base64 of 32 bytes, ' +
        'or 32 plain characters. Generate one with: openssl rand -hex 32'
    );
  }

  return key;
}

/** True when secrets can actually be sealed and opened on this deployment. */
export function isEncryptionAvailable(): boolean {
  try {
    loadKey();
    return true;
  } catch {
    return false;
  }
}

/** Seals a secret. Returns "v1:<iv>:<tag>:<ciphertext>", all base64. */
export function encryptSecret(plaintext: string): string {
  if (typeof plaintext !== 'string' || plaintext === '') {
    throw new Error('Refusing to encrypt an empty secret.');
  }

  const key = loadKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [SCHEME, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(
    ':'
  );
}

/**
 * Opens a sealed secret.
 *
 * Throws if the key is wrong or the value was tampered with - GCM
 * authentication makes a modified ciphertext a hard failure rather than
 * silently returning rubbish that would be sent to a payment provider.
 */
export function decryptSecret(sealed: string): string {
  if (!sealed) throw new Error('No sealed secret was supplied.');

  const parts = sealed.split(':');
  if (parts.length !== 4 || parts[0] !== SCHEME) {
    throw new Error('Sealed secret is not in the expected v1 format.');
  }

  const key = loadKey();
  const [, ivB64, tagB64, dataB64] = parts;

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * The last four characters of a secret, for confirming in the admin console
 * which key is installed without revealing it. Short values return nothing
 * rather than most of themselves.
 */
export function secretLast4(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) return '';
  return plaintext.slice(-4);
}
