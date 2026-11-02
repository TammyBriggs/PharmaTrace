// Unit tests for the GS1 helpers (check digit, GTIN, Digital Link parsing, serials). No database or server needed:
//   cd pharmatrace_backend && node --test tests/gs1.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkDigit, isValidGtin, deriveGtin, randomSerial, parseDigitalLink } = require('../utils/gs1');

test('check digit follows the GS1 mod-10 rule', () => {
  assert.equal(checkDigit('1234567890123'), '1');
  assert.equal(isValidGtin('12345678901231'), true);
  assert.equal(isValidGtin('12345678901232'), false);   // one digit off
  assert.equal(isValidGtin('1234567890123'), false);    // 13 digits
  assert.equal(isValidGtin('1234567890123A'), false);   // not numeric
});

test('deriveGtin is stable per registration number and always valid', () => {
  const a = deriveGtin('Rwanda FDA-HMP-MA-2145');
  assert.equal(a, deriveGtin('Rwanda FDA-HMP-MA-2145'));
  assert.notEqual(a, deriveGtin('Rwanda FDA-HMP-MA-2169'));
  assert.equal(isValidGtin(a), true);
});

test('randomSerial uses the 32-symbol alphabet with no look-alike characters', () => {
  for (let i = 0; i < 200; i++) {
    const s = randomSerial();
    assert.equal(s.length, 12);
    assert.match(s, /^[2-9A-HJ-NP-Z]{12}$/);            // no 0, 1, I or O
  }
  assert.equal(new Set(Array.from({ length: 5000 }, () => randomSerial())).size, 5000);
});

test('parseDigitalLink reads a pack code and ignores the host', () => {
  const want = { gtin: '12345678901231', batchNo: 'RW-0412', serial: 'ABCD2345EFGH' };
  assert.deepEqual(parseDigitalLink('/01/12345678901231/10/RW-0412/21/ABCD2345EFGH'), want);
  assert.deepEqual(parseDigitalLink('https://old-tunnel.ngrok-free.dev/01/12345678901231/10/RW-0412/21/ABCD2345EFGH'), want);
  assert.deepEqual(parseDigitalLink('/01/12345678901231/10/rw-0412/21/abcd2345efgh'), want); // typed in lower case
});

test('parseDigitalLink accepts a batch-level code without a serial', () => {
  assert.deepEqual(parseDigitalLink('/01/12345678901231/10/RW-0412'), { gtin: '12345678901231', batchNo: 'RW-0412', serial: null });
});

test('parseDigitalLink rejects anything that is not a valid PharmaTrace code', () => {
  for (const bad of ['', 'hello', '/01/12345678901232/10/RW-0412', '/01/12345678901231/10/!!', '/01/12345678901231/10/RW-0412/21/not valid', null, undefined])
    assert.equal(parseDigitalLink(bad), null, `should reject ${JSON.stringify(bad)}`);
});
