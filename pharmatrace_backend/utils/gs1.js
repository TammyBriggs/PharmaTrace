const crypto = require('crypto');

// GS1 mod-10 check digit over a 13-digit GTIN-14 body (weights 3,1,3,1… from the right).
function checkDigit(body13) {
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(body13[12 - i]) * (i % 2 === 0 ? 3 : 1);
  return String((10 - (sum % 10)) % 10);
}
const isValidGtin = (g) => /^\d{14}$/.test(g) && checkDigit(g.slice(0, 13)) === g[13];

/** Demo GTIN-14 for a registered product: same product => same GTIN, valid check digit.
 *  NOT a real GS1 company prefix; in production the manufacturer supplies its licensed GTIN. */
function deriveGtin(registrationNumber) {
  const h = BigInt('0x' + crypto.createHash('sha256').update(String(registrationNumber)).digest('hex'));
  const body = '0' + (h % 10n ** 12n).toString().padStart(12, '0');
  return body + checkDigit(body);
}

// AI (21) serials are alphanumeric, up to 20 chars. 12 chars from a 32-symbol alphabet with no
// look-alike characters (no 0/O, 1/I): 32^12 possibilities, so guessing a serial is impractical.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function randomSerial(len = 12) {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % 32]; // 256 % 32 == 0, so no modulo bias
  return s;
}

/** GS1 Digital Link for a batch (no serial) or a unit (with serial). Identifiers only, no status. */
const digitalLink = (gtin, batchNo, serial) =>
  `https://pharmatrace.rw/01/${gtin}/10/${encodeURIComponent(batchNo)}${serial ? `/21/${serial}` : ''}`;

module.exports = { checkDigit, isValidGtin, deriveGtin, randomSerial, digitalLink };
