// Integration tests for accounts: regulator-issued logins, the forced password change, the emailed reset code,
// the sector check, the sign-in rate limit and the risk-map data.
// Needs a running server and a database (a LOCAL or test one: these tests create and deactivate accounts):
//   cd pharmatrace_backend && node --test tests/accounts.integration.test.js
// Set API_URL if the server is not on http://localhost:3000.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { hashResetCode } = require('../utils/password');

const API = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');
const call = async (method, path, body, token) => {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
};

const tag = crypto.randomBytes(4).toString('hex');
const made = [];                       // accounts created here, deactivated at the end (audit rows keep them from being deleted)
const email = (n) => `test-${n}-${tag}@example.test`;

async function insertUser(role, contact, password) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, role, contact, password_hash, is_active) VALUES ($1,$2,$3,$4,true) RETURNING id`,
    [`Test ${role}`, role, contact, await bcrypt.hash(password, 4)]);
  made.push(rows[0].id);
  return rows[0].id;
}

let regulatorToken;
test.before(async () => {
  await insertUser('regulator', email('reg'), 'Regulator#12345');
  const r = await call('POST', '/api/auth/dashboard-login', { contact: email('reg'), password: 'Regulator#12345' });
  assert.equal(r.status, 200, 'regulator can sign in');
  regulatorToken = r.body.token;
});
test.after(async () => {
  await pool.query('UPDATE users SET is_active = false WHERE contact LIKE $1', [`%-${tag}@example.test`]);
  await pool.end();
});

let pharmacist;   // { id, contact, temporaryPassword }
test('a regulator creates a pharmacist: sector must be one of the 15, password is temporary', async () => {
  const bad = await call('POST', '/api/users', { name: 'Ada Pharm', contact: email('ph'), sector: 'Kicukiro' }, regulatorToken);
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /15 Gasabo sectors/);

  const ok = await call('POST', '/api/users', { name: 'Ada Pharm', contact: email('ph'), sector: 'remera sector' }, regulatorToken);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.sector, 'Remera');                       // tidied to the list value
  assert.match(ok.body.temporaryPassword, /^[A-Za-z0-9]{12}$/);
  assert.equal(ok.body.user.mustChangePassword, true);
  pharmacist = { id: ok.body.user.id, contact: email('ph'), temporaryPassword: ok.body.temporaryPassword };

  const dup = await call('POST', '/api/users', { name: 'Ada Pharm', contact: email('ph').toUpperCase(), sector: 'Remera' }, regulatorToken);
  assert.equal(dup.status, 409);                                      // same email in another case is the same account
});

test('only a regulator can create accounts', async () => {
  const none = await call('POST', '/api/users', { name: 'X', contact: email('x'), sector: 'Remera' });
  assert.ok([401, 403].includes(none.status));
  const login = await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: pharmacist.temporaryPassword });
  const asPharmacist = await call('POST', '/api/users', { name: 'X', contact: email('x'), sector: 'Remera' }, login.body.token);
  assert.equal(asPharmacist.status, 403);
});

let freshToken;
test('first sign-in with the temporary password only allows changing it', async () => {
  const login = await call('POST', '/api/auth/login', { contact: pharmacist.contact.toUpperCase(), password: pharmacist.temporaryPassword });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.must_change_password, true);

  const blocked = await call('PUT', '/api/auth/profile', { name: 'New Name' }, login.body.token);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');

  const wrongCurrent = await call('POST', '/api/auth/change-password', { currentPassword: 'nope', newPassword: 'Another#2026' }, login.body.token);
  assert.equal(wrongCurrent.status, 400);
  const weak = await call('POST', '/api/auth/change-password', { currentPassword: pharmacist.temporaryPassword, newPassword: 'short' }, login.body.token);
  assert.equal(weak.status, 400);
  const letters = await call('POST', '/api/auth/change-password', { currentPassword: pharmacist.temporaryPassword, newPassword: 'onlyletters' }, login.body.token);
  assert.equal(letters.status, 400);
  const same = await call('POST', '/api/auth/change-password', { currentPassword: pharmacist.temporaryPassword, newPassword: pharmacist.temporaryPassword }, login.body.token);
  assert.equal(same.status, 400);

  const ok = await call('POST', '/api/auth/change-password', { currentPassword: pharmacist.temporaryPassword, newPassword: 'MyOwn#Pass2026' }, login.body.token);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.must_change_password, false);
  freshToken = ok.body.token;
  pharmacist.password = 'MyOwn#Pass2026';
});

test('after the change the new token works, the old password does not', async () => {
  const profile = await call('PUT', '/api/auth/profile', { sector: 'Kimironko' }, freshToken);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.sector, 'Kimironko');

  const old = await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: pharmacist.temporaryPassword });
  assert.equal(old.status, 401);
  const next = await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: pharmacist.password });
  assert.equal(next.status, 200);
  assert.equal(next.body.user.must_change_password, false);
});

test('the server refuses a sector that is not in Gasabo, even from a signed-in pharmacist', async () => {
  const r = await call('PUT', '/api/auth/profile', { sector: 'Nyamirambo' }, freshToken);
  assert.equal(r.status, 400);
  const typed = await call('PUT', '/api/auth/profile', { sector: 'Remera sector' }, freshToken);
  assert.equal(typed.body.user.sector, 'Remera');
});

test('forgot password never reveals whether an account exists', async () => {
  const known = await call('POST', '/api/auth/forgot-password', { contact: pharmacist.contact });
  const unknown = await call('POST', '/api/auth/forgot-password', { contact: email('nobody') });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.equal(known.body.message, unknown.body.message);
});

test('a reset code works once, is limited to 5 wrong tries, and sets a strong password', async () => {
  const U = "(now() AT TIME ZONE 'UTC')";   // timestamp columns are naive UTC
  const plant = async (code) => {
    await pool.query(`UPDATE password_resets SET used_at = ${U} WHERE user_id = $1 AND used_at IS NULL`, [pharmacist.id]);
    await pool.query(`INSERT INTO password_resets (user_id, token_hash, created_at, expires_at) VALUES ($1,$2, ${U}, ${U} + interval '15 minutes')`,
      [pharmacist.id, hashResetCode(pharmacist.id, code)]);
  };
  const reset = (code, pw) => call('POST', '/api/auth/reset-password', { contact: pharmacist.contact, code, newPassword: pw });

  await plant('123456');
  assert.equal((await reset('123456', 'weak')).status, 400);                       // weak password does not burn the code
  assert.equal((await reset('654321', 'Reset#Pass2026')).status, 400);             // wrong code
  const ok = await reset('123456', 'Reset#Pass2026');
  assert.equal(ok.status, 200);
  assert.equal((await reset('123456', 'Reset#Pass2027')).status, 400);             // a used code is dead
  assert.equal((await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: 'Reset#Pass2026' })).status, 200);

  await plant('111111');
  for (let i = 0; i < 5; i++) assert.equal((await reset('000000', 'Reset#Pass2028')).status, 400);
  assert.equal((await reset('111111', 'Reset#Pass2028')).status, 400);            // 5 wrong tries lock the code, even the right one

  await pool.query(`UPDATE password_resets SET used_at = ${U} WHERE user_id = $1`, [pharmacist.id]);
  await plant('222222');
  await pool.query(`UPDATE password_resets SET expires_at = ${U} - interval '1 minute' WHERE user_id = $1 AND used_at IS NULL`, [pharmacist.id]);
  assert.equal((await reset('222222', 'Reset#Pass2029')).status, 400);            // expired
});

test('a regulator can reset a pharmacist password and deactivate the account', async () => {
  const r = await call('POST', `/api/users/${pharmacist.id}/reset-password`, {}, regulatorToken);
  assert.equal(r.status, 200);
  const login = await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: r.body.temporaryPassword });
  assert.equal(login.body.user.must_change_password, true);

  const off = await call('PATCH', `/api/users/${pharmacist.id}/active`, { active: false }, regulatorToken);
  assert.equal(off.body.user.active, false);
  const denied = await call('POST', '/api/auth/login', { contact: pharmacist.contact, password: r.body.temporaryPassword });
  assert.equal(denied.status, 403);

  const list = await call('GET', `/api/users?search=${encodeURIComponent(tag)}`, undefined, regulatorToken);
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((u) => u.id === pharmacist.id));
});

test('creating a manufacturer with a login email also creates its dashboard login', async () => {
  const lic = `TEST-MFG-${tag.toUpperCase()}`;
  const wallet = `0x${crypto.randomBytes(20).toString('hex')}`;
  const r = await call('POST', '/api/manufacturers', { name: `Test Pharma ${tag}`, licenseNumber: lic, wallet, country: 'India', contactEmail: email('mf') }, regulatorToken);
  assert.equal(r.status, 201);
  assert.equal(r.body.login.contact, email('mf'));
  assert.equal(r.body.manufacturer.loginEmail, email('mf'));
  made.push((await pool.query('SELECT id FROM users WHERE contact = $1', [email('mf')])).rows[0].id);

  const login = await call('POST', '/api/auth/dashboard-login', { contact: email('mf'), password: r.body.login.temporaryPassword });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.role, 'manufacturer');
  assert.equal(login.body.user.must_change_password, true);

  // issuing again resets the temporary password; the old one stops working
  const again = await call('POST', `/api/manufacturers/${r.body.manufacturer.id}/login`, {}, regulatorToken);
  assert.equal(again.status, 200);
  assert.equal(again.body.created, false);
  assert.notEqual(again.body.temporaryPassword, r.body.login.temporaryPassword);
  const stale = await call('POST', '/api/auth/dashboard-login', { contact: email('mf'), password: r.body.login.temporaryPassword });
  assert.equal(stale.status, 401);

  const dup = await call('POST', '/api/manufacturers', { name: 'Other', licenseNumber: `${lic}-2`, wallet: `0x${crypto.randomBytes(20).toString('hex')}`, country: 'India', contactEmail: email('mf') }, regulatorToken);
  assert.equal(dup.status, 409);
});

test('repeated failed sign-ins are slowed down (429), per account', async () => {
  const target = email('victim');
  let last;
  for (let i = 0; i < 10; i++) last = await call('POST', '/api/auth/dashboard-login', { contact: target, password: `wrong-${i}` });
  assert.equal(last.status, 429);
  assert.match(last.body.error, /Too many/);
  const other = await call('POST', '/api/auth/dashboard-login', { contact: email('someone-else'), password: 'x' });
  assert.equal(other.status, 401);                                                  // another account is not affected
});

test('the risk map returns the 15 sectors, only status counts, and no coordinates of scans', async () => {
  const r = await call('GET', '/api/overview/map?range=all', undefined, regulatorToken);
  assert.equal(r.status, 200);
  assert.equal(r.body.sectors.length, 15);
  assert.equal(r.body.totals.scans, r.body.sectors.reduce((n, s) => n + s.total, 0));
  for (const s of r.body.sectors) {
    assert.equal(s.concern, s.flagged + s.expired + s.revoked);
    assert.equal(s.status, s.total === 0 ? 'none' : s.concern > 0 ? 'concern' : 'ok');
    assert.ok(s.lat < -1.8 && s.lat > -2.0 && s.lng > 30.0 && s.lng < 30.3, `${s.sector} is inside Gasabo`);
  }
  const anon = await call('GET', '/api/overview/map?range=all');
  assert.ok([401, 403].includes(anon.status));
});
