const test = require('node:test');
const assert = require('node:assert');

const { formatFrom } = require('../.test-build/email/format.js');
const { describeSmtpError } = require('../.test-build/email/smtpErrors.js');

/**
 * The envelope header and the error wording are the two parts of the mail
 * configuration that are pure functions, and both are easy to get subtly
 * wrong in ways nobody notices until mail is already failing.
 */

test('a display name and address become a single From header', () => {
  assert.strictEqual(formatFrom('Hostmattic', 'no-reply@hostmattic.com'), 'Hostmattic <no-reply@hostmattic.com>');
});

test('with no display name the bare address is used', () => {
  assert.strictEqual(formatFrom('', 'no-reply@hostmattic.com'), 'no-reply@hostmattic.com');
  assert.strictEqual(formatFrom('   ', 'no-reply@hostmattic.com'), 'no-reply@hostmattic.com');
});

test('a display name that would break the header is dropped, not escaped', () => {
  // A quote or an angle bracket in the name produces a header the mail server
  // either rejects or misparses. Dropping the name still sends; escaping it
  // into something unreadable does not help anyone.
  assert.strictEqual(formatFrom('Host"mattic', 'a@b.com'), 'a@b.com');
  assert.strictEqual(formatFrom('Host<mattic>', 'a@b.com'), 'a@b.com');
});

test('no From address means no From header at all', () => {
  // The caller treats empty as "not configured" rather than sending a message
  // with a blank sender, which every server refuses.
  assert.strictEqual(formatFrom('Hostmattic', ''), '');
  assert.strictEqual(formatFrom('Hostmattic', '   '), '');
});

test('an authentication failure names the credentials, not the connection', () => {
  const msg = describeSmtpError({ code: 'EAUTH', message: 'Invalid login' });
  assert.match(msg, /username or password/i);
});

test('a refused connection points at the host and port', () => {
  const msg = describeSmtpError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' });
  assert.match(msg, /host and port/i);
});

test('a timeout explains the TLS/port pairing, which is the usual cause', () => {
  // 465 with TLS off, or 587 with TLS on, hangs until it times out. Without
  // this hint it looks exactly like a firewall problem.
  const msg = describeSmtpError({ code: 'ETIMEDOUT', message: 'timeout' });
  assert.match(msg, /465/);
  assert.match(msg, /587/);
});

test('a certificate problem mentions the option that bypasses it', () => {
  const msg = describeSmtpError({ message: 'self signed certificate in chain' });
  assert.match(msg, /certificate/i);
  assert.match(msg, /allow invalid certificate/i);
});

test('an unrecognised error is passed through rather than replaced', () => {
  // Inventing a friendly message for an error we do not understand would hide
  // the only information available.
  const msg = describeSmtpError({ message: 'something specific from the server' });
  assert.strictEqual(msg, 'something specific from the server');
});
