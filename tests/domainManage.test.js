const test = require('node:test');
const assert = require('node:assert');

const { apiClient, isLiveApiConfigured } = require('../.test-build/api/client.js');

/**
 * These tests pin the WIRE FORMAT of a nameserver change.
 *
 * The portal reported "Nameservers updated" while the registry still held the
 * old ones, because the route sent `domain-name` plus `ns1`, `ns2`, `ns3` -
 * none of which this API accepts. It wants `order-id` and `ns` repeated once
 * per server. Upstream rejected every call and the result was discarded.
 *
 * The same comma-join mistake already cost a paid registration in bug-047, so
 * the serialisation is worth asserting directly rather than trusting by
 * inspection.
 */

function withLiveEnv(fn) {
  const saved = {
    id: process.env.RESELLER_AUTH_USERID,
    key: process.env.RESELLER_API_KEY,
    base: process.env.RESELLER_API_BASE_URL,
  };
  process.env.RESELLER_AUTH_USERID = 'test-user';
  process.env.RESELLER_API_KEY = 'test-key';
  process.env.RESELLER_API_BASE_URL = 'https://upstream.invalid/api';
  const savedFetch = global.fetch;
  try {
    return fn();
  } finally {
    global.fetch = savedFetch;
    for (const [k, v] of [
      ['RESELLER_AUTH_USERID', saved.id],
      ['RESELLER_API_KEY', saved.key],
      ['RESELLER_API_BASE_URL', saved.base],
    ]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

/** Captures the request apiClient would have sent. */
function captureRequest(responseBody) {
  const seen = {};
  global.fetch = async (url, init) => {
    seen.url = String(url);
    seen.body = init && init.body ? String(init.body) : '';
    seen.method = (init && init.method) || 'GET';
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify(responseBody || { status: 'Success' }),
    };
  };
  return seen;
}

test('an array parameter is sent as one field per entry, never comma-joined', async () => {
  await withLiveEnv(async () => {
    const seen = captureRequest();
    await apiClient('/domains/modify-ns.json', {
      'order-id': '127542631',
      ns: ['ns3.secureparkme.com', 'ns4.secureparkme.com'],
    }, 'POST');

    const params = new URLSearchParams(seen.body);
    assert.deepStrictEqual(params.getAll('ns'), [
      'ns3.secureparkme.com',
      'ns4.secureparkme.com',
    ]);
    // The failure mode from bug-047: one field holding both hosts.
    assert.ok(!seen.body.includes('%2C'), 'nameservers must not be comma-joined');
  });
});

test('the domain is addressed by order-id, not by name', async () => {
  await withLiveEnv(async () => {
    const seen = captureRequest();
    await apiClient('/domains/modify-ns.json', {
      'order-id': '127542631',
      ns: ['a.example.com', 'b.example.com'],
    }, 'POST');

    const params = new URLSearchParams(seen.body);
    assert.strictEqual(params.get('order-id'), '127542631');
    assert.strictEqual(params.get('domain-name'), null);
    // ns1/ns2 were the old shape and mean nothing to this endpoint.
    assert.strictEqual(params.get('ns1'), null);
    assert.strictEqual(params.get('ns2'), null);
  });
});

test('an upstream ERROR status is reported as failure, not swallowed', async () => {
  await withLiveEnv(async () => {
    captureRequest({ status: 'ERROR', message: 'Invalid order id' });
    const res = await apiClient('/domains/modify-ns.json', {
      'order-id': 'nope',
      ns: ['a.example.com', 'b.example.com'],
    }, 'POST');

    // The route now checks this. It previously did not, which is how a
    // rejected change was reported to the customer as a success.
    assert.strictEqual(res.success, false);
    assert.match(res.error, /Invalid order id/);
  });
});

test('credentials are attached to every call', async () => {
  await withLiveEnv(async () => {
    const seen = captureRequest();
    await apiClient('/domains/modify-ns.json', { 'order-id': '1', ns: ['a.x.com', 'b.x.com'] }, 'POST');
    const params = new URLSearchParams(seen.body);
    assert.strictEqual(params.get('auth-userid'), 'test-user');
    assert.strictEqual(params.get('api-key'), 'test-key');
  });
});

test('without credentials the client reports mock rather than calling out', async () => {
  const saved = { id: process.env.RESELLER_AUTH_USERID, key: process.env.RESELLER_API_KEY };
  delete process.env.RESELLER_AUTH_USERID;
  delete process.env.RESELLER_API_KEY;
  try {
    assert.strictEqual(isLiveApiConfigured(), false);
    let called = false;
    const savedFetch = global.fetch;
    global.fetch = async () => {
      called = true;
      throw new Error('should not be reached');
    };
    const res = await apiClient('/domains/modify-ns.json', {}, 'POST');
    global.fetch = savedFetch;
    assert.strictEqual(res.isMock, true);
    assert.strictEqual(called, false);
  } finally {
    if (saved.id === undefined) delete process.env.RESELLER_AUTH_USERID;
    else process.env.RESELLER_AUTH_USERID = saved.id;
    if (saved.key === undefined) delete process.env.RESELLER_API_KEY;
    else process.env.RESELLER_API_KEY = saved.key;
  }
});
