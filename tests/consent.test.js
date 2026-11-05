const test = require('node:test');
const assert = require('node:assert');

const {
  NOTICE_VERSION,
  CONSENT_PURPOSES,
  purposesForStage,
  purposeByKey,
  optionalPurposes,
  isWithdrawable,
} = require('../.test-build/legal/consent.js');

const { RETENTION_SCHEDULE, erasableRecords, retainedRecords } = require('../.test-build/legal/retention.js');

test('every purpose states what is collected and why', () => {
  // A notice that names a purpose without saying what it takes, or why, is not
  // the itemised notice the Act asks for.
  for (const p of CONSENT_PURPOSES) {
    assert.ok(p.label && p.label.length > 3, `${p.key} needs a label`);
    assert.ok(p.data && p.data.length > 10, `${p.key} must say what data it collects`);
    assert.ok(p.why && p.why.length > 10, `${p.key} must say why`);
    assert.ok(['signup', 'checkout'].includes(p.stage), `${p.key} needs a stage`);
    assert.strictEqual(typeof p.optional, 'boolean');
  }
});

test('the notice is versioned, so a later edit cannot rewrite what someone agreed to', () => {
  assert.match(NOTICE_VERSION, /^\d{4}-\d{2}-\d{2}\.\d+$/);
});

test('registrant data is collected at checkout, not signup', () => {
  // Asking for a postal address to open an account collects data before there
  // is a purpose for it. It is needed when a domain is actually registered.
  const registrant = purposeByKey('registrant');
  assert.strictEqual(registrant.stage, 'checkout');
  assert.ok(!purposesForStage('signup').some((p) => p.key === 'registrant'));
});

test('purposes that share data outside the business say so', () => {
  const registrant = purposeByKey('registrant');
  assert.ok(registrant.sharedWith, 'registrant data leaves the business and must disclose that');
  assert.match(registrant.sharedWith, /registr/i);

  const email = purposeByKey('service_email');
  assert.ok(email.sharedWith, 'the email provider is a third party and must be disclosed');
});

test('only genuinely optional purposes can be withdrawn', () => {
  assert.strictEqual(isWithdrawable('marketing'), true);

  // Required ones are not toggles. Letting the portal "withdraw" one would
  // tell the customer processing had stopped when it had not.
  assert.strictEqual(isWithdrawable('account'), false);
  assert.strictEqual(isWithdrawable('registrant'), false);
  assert.strictEqual(isWithdrawable('service_email'), false);
  assert.strictEqual(isWithdrawable('nonsense'), false);
});

test('marketing is the only optional purpose, and is not bundled with the service', () => {
  const optional = optionalPurposes();
  assert.strictEqual(optional.length, 1);
  assert.strictEqual(optional[0].key, 'marketing');
});

test('every retention rule carries a reason and an erasable flag', () => {
  // "We cannot delete that" is not an answer to an erasure request; the reason
  // is what makes it one.
  for (const r of RETENTION_SCHEDULE) {
    assert.ok(r.record && r.record.length > 3);
    assert.ok(r.reason && r.reason.length > 20, `${r.record} needs a real reason`);
    assert.ok(['legal', 'contractual', 'consent'].includes(r.basis), `${r.record} needs a basis`);
    assert.strictEqual(typeof r.erasable, 'boolean');
  }
});

test('records kept on legal authority are never erasable', () => {
  // If a statute requires retention, an erasure request cannot override it -
  // and the code must not let a future edit claim otherwise.
  for (const r of RETENTION_SCHEDULE.filter((x) => x.basis === 'legal')) {
    assert.strictEqual(r.erasable, false, `${r.record} is kept by law and cannot be erasable`);
  }
});

test('consent records are retained, not deleted on withdrawal', () => {
  // Deleting them would destroy the proof that processing was lawful while it
  // ran, which is the opposite of what the evidence requirement wants.
  const consentRule = RETENTION_SCHEDULE.find((r) => /consent/i.test(r.record));
  assert.ok(consentRule, 'consent records must appear in the schedule');
  assert.strictEqual(consentRule.erasable, false);
});

test('the schedule splits cleanly into erasable and retained', () => {
  assert.strictEqual(erasableRecords().length + retainedRecords().length, RETENTION_SCHEDULE.length);
  assert.ok(erasableRecords().length > 0, 'an erasure request must be able to do something');
  assert.ok(retainedRecords().length > 0, 'some records are genuinely required');
});
