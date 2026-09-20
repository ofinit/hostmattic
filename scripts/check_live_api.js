const fs = require('fs');

const envContent = fs.readFileSync('.env', 'utf8');
function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=["']?([^"'\\r\\n]+)`, 'm'));
  return match ? match[1] : '';
}

const authUserId = getEnv('RESELLER_AUTH_USERID');
const apiKey = getEnv('RESELLER_API_KEY');
const baseUrl = getEnv('RESELLER_API_BASE_URL') || 'https://httpapi.com/api';

console.log('Testing Upstream Reseller API:');
console.log('Base URL:', baseUrl);
console.log('Auth User ID:', authUserId);
console.log('API Key configured:', apiKey ? 'YES (Length ' + apiKey.length + ')' : 'NO');

async function run() {
  // Test 1: Check balance
  try {
    const url = `${baseUrl}/billing/reseller-balance.json?auth-userid=${authUserId}&api-key=${apiKey}&reseller-id=${authUserId}`;
    const res = await fetch(url);
    const body = await res.text();
    console.log('\n--- Test 1: Reseller Balance ---');
    console.log('HTTP Status:', res.status);
    console.log('Response:', body);
  } catch (err) {
    console.error('Test 1 error:', err);
  }

  // Test 2: Check domain availability
  try {
    const url = `${baseUrl}/domains/available.json?auth-userid=${authUserId}&api-key=${apiKey}&domain-name=hostmattictest12345&tlds=com&tlds=net`;
    const res = await fetch(url);
    const body = await res.text();
    console.log('\n--- Test 2: Domain Check ---');
    console.log('HTTP Status:', res.status);
    console.log('Response:', body);
  } catch (err) {
    console.error('Test 2 error:', err);
  }

  // Test 3: Search customers in reseller account
  try {
    const url = `${baseUrl}/customers/search.json?auth-userid=${authUserId}&api-key=${apiKey}&no-of-records=10&page-no=1`;
    const res = await fetch(url);
    const body = await res.text();
    console.log('\n--- Test 3: Customer Search ---');
    console.log('HTTP Status:', res.status);
    console.log('Response:', body);
  } catch (err) {
    console.error('Test 3 error:', err);
  }
}

run();
