// Integration tests: the real HTTP API, the real database and the real contract working together.
// Needs a running server and a seeded database (node scripts/seedDemoData.js --yes):
//   cd pharmatrace_backend && node --test tests/api.integration.test.js
// Set API_URL if the server is not on http://localhost:3000.
const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');

const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const get = async (p) => { const r = await fetch(API + p); return { status: r.status, body: await r.json().catch(() => null) }; };
const one = async (status) => (await pool.query(
  `SELECT batch_no, gtin, batch_uuid FROM (SELECT b.batch_no, b.gtin, b.id AS batch_uuid FROM batches b WHERE b.status = $1 ORDER BY b.created_at LIMIT 1) x`, [status])).rows[0];

test.after(() => pool.end());

test('an approved batch scans as authentic, checked against the blockchain', async () => {
  const b = await one('approved');
  const r = await get(`/api/verify?batch=${encodeURIComponent(b.batch_no)}&gtin=${b.gtin}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.verdict, 'authentic');
  assert.match(r.body.source, /blockchain/);
});

test('flagged, revoked and pending batches get their own verdict', async () => {
  for (const [status, verdict] of [['flagged', 'flagged'], ['revoked', 'revoked'], ['pending', 'pending']]) {
    const b = await one(status);
    if (!b) continue;
    const r = await get(`/api/verify?batch=${encodeURIComponent(b.batch_no)}&gtin=${b.gtin}`);
    assert.equal(r.body.verdict, verdict, `${status} batch`);
  }
});

test('a batch number alone is enough when it is unique', async () => {
  const b = await one('approved');
  const r = await get(`/api/verify?batch=${encodeURIComponent(b.batch_no.toLowerCase())}`);   // typed in lower case
  assert.equal(r.status, 200);
  assert.equal(r.body.verdict, 'authentic');
  assert.equal(r.body.batch.gtin, b.gtin);
});

test('a GS1 code from an old tunnel address still verifies (the host is ignored)', async () => {
  const b = await one('approved');
  const code = `https://some-old-tunnel.ngrok-free.dev/01/${b.gtin}/10/${b.batch_no}`;
  const r = await get(`/api/verify?code=${encodeURIComponent(code)}`);
  assert.equal(r.body.verdict, 'authentic');
});

test('an unknown batch is "not_found", never "authentic"', async () => {
  const r = await get('/api/verify?batch=NOPE-9999');
  assert.equal(r.status, 200);
  assert.equal(r.body.verdict, 'not_found');
});

test('bad input is rejected with a clear 400', async () => {
  for (const q of ['code=hello', 'code=/01/12345678901232/10/RW-0412', 'batch=%20', '']) {
    const r = await get(`/api/verify?${q}`);
    assert.equal(r.status, 400, q);
    assert.match(r.body.error, /not a PharmaTrace/i);
  }
});

test('the public history starts at approval, oldest first, and shows no staff names or reasons', async () => {
  const b = await one('approved');
  const r = await get(`/api/verify/history?batch=${encodeURIComponent(b.batch_no)}&gtin=${b.gtin}`);
  assert.equal(r.status, 200);
  const events = r.body.events;
  assert.ok(events.length >= 1);
  assert.equal(events[0].event, 'approved');                       // the manufacturer's submission is not public
  assert.ok(events.every((e) => e.event !== 'submitted'));
  const times = events.map((e) => Date.parse(e.at));
  assert.deepEqual(times, [...times].sort((a, c) => a - c));       // oldest first
  for (const e of events) assert.deepEqual(Object.keys(e).sort(), ['at', 'by', 'event', 'statusAfter', 'txHash']);
});

test('history of an unknown batch is a 404', async () => {
  const r = await get('/api/verify/history?batch=NOPE-9999&gtin=12345678901231');
  assert.equal(r.status, 404);
});

test('recording a sale needs a signed-in pharmacist', async () => {
  const r = await fetch(`${API}/api/serials/dispense`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: '/01/12345678901231/10/RW-0412/21/ABCD2345EFGH' }) });
  assert.ok([401, 403].includes(r.status), `got ${r.status}`);
});

test('dashboard endpoints refuse requests without a token', async () => {
  for (const p of ['/api/batches', '/api/manufacturers', '/api/overview', '/api/audit']) {
    const r = await fetch(API + p);
    assert.ok([401, 403].includes(r.status), `${p} returned ${r.status}`);
  }
});

test('the audit log hash chain is intact', async () => {
  const { verifyAuditChain } = require('../utils/audit');
  const v = await verifyAuditChain();
  assert.equal(v.ok, true);
});
