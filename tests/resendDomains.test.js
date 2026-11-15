const test = require('node:test');
const assert = require('node:assert');

const { domainOfFrom } = require('../.test-build/email/resendDomains.js');

test('the domain is read out of an envelope sender', () => {
  assert.strictEqual(domainOfFrom('Hostmattic <no-reply@hostmattic.com>'), 'hostmattic.com');
  assert.strictEqual(domainOfFrom('no-reply@hostmattic.com'), 'hostmattic.com');
  assert.strictEqual(domainOfFrom('  Some One <A@B.COM>  '), 'b.com');
});

test('a subdomain is kept distinct from the bare domain', () => {
  // Resend treats these as different domains: verifying send.hostmattic.com
  // does not let you send from hostmattic.com. Collapsing them here would
  // report a verified domain that Resend then refuses.
  assert.strictEqual(domainOfFrom('x@send.hostmattic.com'), 'send.hostmattic.com');
  assert.notStrictEqual(domainOfFrom('x@send.hostmattic.com'), 'hostmattic.com');
});

test('an address with no domain yields null rather than a guess', () => {
  assert.strictEqual(domainOfFrom('not-an-address'), null);
  assert.strictEqual(domainOfFrom('trailing@'), null);
  assert.strictEqual(domainOfFrom(''), null);
});

test('the last @ wins, so a quoted local part cannot shift the domain', () => {
  assert.strictEqual(domainOfFrom('"odd@name"@hostmattic.com'), 'hostmattic.com');
});
