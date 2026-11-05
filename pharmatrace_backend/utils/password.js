const crypto = require('crypto');

// No 0/O, 1/l/I: a temporary password is read off a screen and typed by hand.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Why a password is not acceptable, or null if it is fine. bcrypt only reads the first 72 bytes. */
function passwordProblem(pw, contact) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Use at least 8 characters.';
  if (Buffer.byteLength(pw) > 72) return 'Use at most 72 characters.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Include at least one letter and one number.';
  if (contact && pw.toLowerCase() === String(contact).toLowerCase()) return 'The password cannot be the same as your email.';
  return null;
}

/** 12 random characters that always satisfy passwordProblem(). */
function generateTempPassword() {
  for (;;) {
    let p = '';
    for (let i = 0; i < 12; i++) p += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!passwordProblem(p)) return p;
  }
}

/** Six-digit one-time code for the "forgot password" email. */
const generateResetCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** What is stored for a reset code: bound to the user so one code cannot be replayed on another account. */
const hashResetCode = (userId, code) => crypto.createHash('sha256').update(`${userId}:${code}`).digest('hex');

const sameHash = (a, b) => {
  const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());

module.exports = { passwordProblem, generateTempPassword, generateResetCode, hashResetCode, sameHash, isEmail };
