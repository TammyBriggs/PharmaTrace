// Rate limiting with express-rate-limit. Counters live in this process's memory, which is right for one server
// (the Render free plan runs one) and resets on restart. More than one server instance would need a shared store
// such as Redis. server.js sets "trust proxy", so req.ip is the visitor, not the tunnel or load balancer.
const rateLimit = require('express-rate-limit');

const make = ({ windowMs, limit, error, keyGenerator, skipSuccessfulRequests = false }) => rateLimit({
  windowMs,
  limit,
  standardHeaders: 'draft-7', // RateLimit-* and Retry-After headers
  legacyHeaders: false,
  skipSuccessfulRequests,
  ...(keyGenerator ? { keyGenerator } : {}),
  message: { error },
});

const who = (req) => `${req.ip}|${String(req.body?.contact ?? '').trim().toLowerCase().slice(0, 120)}`;

/** Public scan endpoints: per visitor. */
const scanLimiter = (limit = 60, windowMs = 60_000) =>
  make({ windowMs, limit, error: 'Too many scans. Please wait a moment and try again.' });

/** Sign-in: only failed attempts count, per visitor and account, so a guessed password is slowed but a real user is not. */
const loginLimiter = make({
  windowMs: 15 * 60_000, limit: 8, keyGenerator: who, skipSuccessfulRequests: true,
  error: 'Too many failed sign-in attempts. Try again in 15 minutes.',
});

/** Asking for a reset code (each request can send an email): per visitor and account. */
const forgotLimiter = make({
  windowMs: 15 * 60_000, limit: 5, keyGenerator: who,
  error: 'Too many reset requests. Try again in 15 minutes.',
});

/** Using a reset code. Each code also locks itself after 5 wrong tries (authController), so this is a second fence. */
const resetLimiter = make({
  windowMs: 15 * 60_000, limit: 15, keyGenerator: who,
  error: 'Too many password reset attempts. Try again in 15 minutes.',
});

module.exports = { scanLimiter, loginLimiter, forgotLimiter, resetLimiter };
