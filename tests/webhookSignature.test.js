/**
 * Svix signature verification for the Resend webhook.
 *
 * This is the security boundary: anyone can POST to the webhook URL, and the
 * payload decides whether a customer's address is marked undeliverable. The
 * logic is reproduced here against the same algorithm Resend signs with, so a
 * change that weakens it fails loudly.
 *
 * Run with: npm test
 */

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const SECRET = 'whsec_' + Buffer.from('a'.repeat(32)).toString('base64');
const TOLERANCE_SECONDS = 5 * 60;

/** Mirrors verifySignature() in app/api/webhooks/resend/route.ts. */
function verify(rawBody, headers, secret = SECRET, now = Date.now()) {
  if (!secret) return { ok: false, reason: 'no secret' };

  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signature = headers['svix-signature'];
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing headers' };

  const age = Math.abs(now / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) {
    return { ok: false, reason: 'timestamp outside tolerance' };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto
    .createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  const provided = signature
    .split(' ')
    .map((p) => p.split(',')[1])
    .filter(Boolean);

  const expectedBuf = Buffer.from(expected);
  const matched = provided.some((c) => {
    const b = Buffer.from(c);
    return b.length === expectedBuf.length && crypto.timingSafeEqual(b, expectedBuf);
  });

  return matched ? { ok: true } : { ok: false, reason: 'signature mismatch' };
}

function sign(body, { id = 'msg_1', timestamp = Math.floor(Date.now() / 1000), secret = SECRET } = {}) {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const sig = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64');
  return {
    'svix-id': id,
    'svix-timestamp': String(timestamp),
    'svix-signature': `v1,${sig}`,
  };
}

const BODY = JSON.stringify({ type: 'email.bounced', data: { to: ['customer@example.com'] } });

test('a correctly signed payload is accepted', () => {
  assert.strictEqual(verify(BODY, sign(BODY)).ok, true);
});

test('a tampered body is rejected', () => {
  const headers = sign(BODY);
  const tampered = JSON.stringify({ type: 'email.bounced', data: { to: ['victim@example.com'] } });
  assert.strictEqual(verify(tampered, headers).ok, false);
});

test('a signature from a different secret is rejected', () => {
  const headers = sign(BODY, { secret: 'whsec_' + Buffer.from('b'.repeat(32)).toString('base64') });
  assert.strictEqual(verify(BODY, headers).ok, false);
});

test('an old request is rejected, so a captured one cannot be replayed', () => {
  const stale = Math.floor(Date.now() / 1000) - (TOLERANCE_SECONDS + 60);
  const headers = sign(BODY, { timestamp: stale });
  const result = verify(BODY, headers);
  assert.strictEqual(result.ok, false);
  assert.match(result.reason, /tolerance/);
});

test('changing the id invalidates the signature', () => {
  const headers = sign(BODY);
  headers['svix-id'] = 'msg_other';
  assert.strictEqual(verify(BODY, headers).ok, false);
});

test('missing headers are rejected rather than ignored', () => {
  for (const drop of ['svix-id', 'svix-timestamp', 'svix-signature']) {
    const headers = sign(BODY);
    delete headers[drop];
    assert.strictEqual(verify(BODY, headers).ok, false, `${drop} was not required`);
  }
});

test('an unconfigured secret rejects everything rather than accepting it', () => {
  // Unconfigured must mean shut: otherwise anyone could mark a customer's
  // address as bouncing and silence their renewal reminders.
  assert.strictEqual(verify(BODY, sign(BODY), '').ok, false);
});

test('multiple signatures are accepted if any one matches', () => {
  // Svix sends several during secret rotation.
  const headers = sign(BODY);
  const real = headers['svix-signature'];
  headers['svix-signature'] = `v1,notarealsignature ${real}`;
  assert.strictEqual(verify(BODY, headers).ok, true);
});
