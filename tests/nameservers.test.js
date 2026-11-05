const test = require('node:test');
const assert = require('node:assert');

const {
  configuredNameservers,
  usableNameservers,
  nameserverReport,
  __resetNameserverCache,
} = require('../.test-build/dns/nameservers.js');

// Deliberately no live DNS here. A test that asserts ns1.hostmattic.com does
// not resolve would start failing the moment that is fixed, which is the
// opposite of what a test should do.
function withEnv(value, fn) {
  const previous = process.env.BRAND_NAMESERVERS;
  if (value === undefined) delete process.env.BRAND_NAMESERVERS;
  else process.env.BRAND_NAMESERVERS = value;
  __resetNameserverCache();
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.BRAND_NAMESERVERS;
    else process.env.BRAND_NAMESERVERS = previous;
    __resetNameserverCache();
  }
}

test('unset means no nameservers are claimed', async () => {
  await withEnv(undefined, async () => {
    assert.deepStrictEqual(configuredNameservers(), []);
    assert.deepStrictEqual(await usableNameservers(), []);
  });
});

test('an empty or comma-only value claims nothing', async () => {
  for (const value of ['', '   ', ',', ' , , ']) {
    await withEnv(value, async () => {
      assert.deepStrictEqual(configuredNameservers(), [], `for ${JSON.stringify(value)}`);
      assert.deepStrictEqual(await usableNameservers(), []);
    });
  }
});

test('entries are trimmed and lowercased', () => {
  withEnv('  NS1.Hostmattic.com , ns2.HOSTMATTIC.com  ', () => {
    assert.deepStrictEqual(configuredNameservers(), ['ns1.hostmattic.com', 'ns2.hostmattic.com']);
  });
});

test('blank entries between commas are dropped', () => {
  withEnv('ns1.example.com,,ns2.example.com,', () => {
    assert.deepStrictEqual(configuredNameservers(), ['ns1.example.com', 'ns2.example.com']);
  });
});

test('the list is capped at the 13 a registry accepts', () => {
  const many = Array.from({ length: 20 }, (_, i) => `ns${i + 1}.example.com`).join(',');
  withEnv(many, () => {
    assert.strictEqual(configuredNameservers().length, 13);
  });
});

test('an unconfigured report explains what happens instead', async () => {
  await withEnv(undefined, async () => {
    const report = await nameserverReport();
    assert.deepStrictEqual(report.configured, []);
    assert.deepStrictEqual(report.usable, []);
    assert.match(report.verdict, /BRAND_NAMESERVERS is not set/);
    // It must say what the consequence is, not merely that it is unset.
    assert.match(report.verdict, /upstream/i);
  });
});
