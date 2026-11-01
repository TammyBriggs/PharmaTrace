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

/** Public address that QR codes point to (set PUBLIC_BASE_URL in .env, e.g. your ngrok https URL). */
function baseUrl() {
  const raw = String(process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  return raw || `http://localhost:${process.env.PORT || 3000}`;
}

/** GS1 Digital Link for a batch (no serial) or a unit (with serial). Identifiers only, no status. */
const digitalLink = (gtin, batchNo, serial) =>
  `${baseUrl()}/01/${gtin}/10/${encodeURIComponent(batchNo)}${serial ? `/21/${serial}` : ''}`;

/**
 * Reads GTIN / batch / serial out of a scanned GS1 Digital Link. The host is ignored on purpose, so codes
 * printed with an older address (or a different tunnel) still verify. Returns null if it is not a PharmaTrace code.
 */
function parseDigitalLink(input) {
  let path = String(input || '').trim().slice(0, 600);
  if (/^https?:\/\//i.test(path)) { try { path = new URL(path).pathname; } catch { return null; } }
  const m = path.match(/\/01\/(\d{14})(?:\/10\/([^/?#]+))?(?:\/21\/([^/?#]+))?\/?$/);
  if (!m || !isValidGtin(m[1])) return null;
  let batchNo = null;
  try { batchNo = m[2] ? decodeURIComponent(m[2]).toUpperCase() : null; } catch { return null; }
  const serial = m[3] ? m[3].toUpperCase() : null;
  if (batchNo !== null && !/^[A-Z0-9][A-Z0-9\-/]{2,39}$/.test(batchNo)) return null;
  if (serial !== null && !/^[A-Z0-9]{1,20}$/.test(serial)) return null;
  return { gtin: m[1], batchNo, serial };
}

module.exports = { checkDigit, isValidGtin, deriveGtin, randomSerial, digitalLink, parseDigitalLink, baseUrl };
