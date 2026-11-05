const test = require('node:test');
const assert = require('node:assert');

const {
  FALLBACK_USD_INR_RATE,
  configuredUsdInrRate,
  usdInrRate,
  usdInrRateDetail,
  extractInrRate,
  __resetFxCache,
} = require('../.test-build/pricing/fx.js');

function withEnv(value, fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'USD_INR_RATE');
  const prev = process.env.USD_INR_RATE;
  if (value === undefined) delete process.env.USD_INR_RATE;
  else process.env.USD_INR_RATE = value;
  try {
    return fn();
  } finally {
    if (had) process.env.USD_INR_RATE = prev;
    else delete process.env.USD_INR_RATE;
    __resetFxCache();
  }
}

test('with nothing configured the rate is exactly what the eight literals said', () => {
  withEnv(undefined, () => {
    __resetFxCache();
    assert.strictEqual(usdInrRate(), 83.5);
    assert.strictEqual(FALLBACK_USD_INR_RATE, 83.5);
    const d = usdInrRateDetail();
    assert.strictEqual(d.source, 'fallback');
    assert.strictEqual(d.stale, false);
  });
});

test('the environment can correct the rate without a deploy', () => {
  withEnv('91.25', () => {
    __resetFxCache();
    assert.strictEqual(usdInrRate(), 91.25);
    assert.strictEqual(usdInrRateDetail().source, 'configured');
  });
});

test('an implausible configured rate is refused, not used', () => {
  // A rate of 1 would sell a Rs1,085 domain for $1,085; a rate of 0 would
  // make the catalogue free. Both must fall back rather than reprice.
  for (const bad of ['0', '1', '-5', 'abc', '', '99999']) {
    withEnv(bad, () => {
      __resetFxCache();
      assert.strictEqual(configuredUsdInrRate(), null, `rate ${bad} should be refused`);
      assert.strictEqual(usdInrRate(), FALLBACK_USD_INR_RATE);
    });
  }
});

test('a plausible rate at the edges of the band is accepted', () => {
  withEnv('50', () => { __resetFxCache(); assert.strictEqual(usdInrRate(), 50); });
  withEnv('150', () => { __resetFxCache(); assert.strictEqual(usdInrRate(), 150); });
});

test('extractInrRate reads the shapes the common endpoints return', () => {
  assert.strictEqual(extractInrRate({ rates: { INR: 88.1 } }), 88.1);
  assert.strictEqual(extractInrRate({ conversion_rates: { INR: 87 } }), 87);
  assert.strictEqual(extractInrRate({ data: { INR: 86.5 } }), 86.5);
  assert.strictEqual(extractInrRate({ INR: 85 }), 85);
  assert.strictEqual(extractInrRate({ rate: 84 }), 84);
});

test('extractInrRate refuses junk rather than returning something plausible-looking', () => {
  assert.strictEqual(extractInrRate(null), null);
  assert.strictEqual(extractInrRate({}), null);
  assert.strictEqual(extractInrRate('88'), null);
  assert.strictEqual(extractInrRate({ rates: { INR: 0 } }), null);
  assert.strictEqual(extractInrRate({ rates: { INR: 'unavailable' } }), null);
  assert.strictEqual(extractInrRate({ error: 'rate limited' }), null);
});
