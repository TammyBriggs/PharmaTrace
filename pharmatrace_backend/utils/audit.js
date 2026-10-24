const crypto = require('crypto');
const pool = require('../config/db');

const LOCK_KEY = 727001; // serialises writers so the chain never forks
const GENESIS = '0'.repeat(64);

// Deterministic JSON: keys sorted at every level (jsonb does not preserve key order).
function stable(v) {
  if (v === undefined || v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
}

function computeHash(prev, e) {
  const payload = stable({
    prev,
    ts: String(e.ts_ms),
    actor_id: e.actor_id ?? null,
    actor_wallet: e.actor_wallet ? String(e.actor_wallet).toLowerCase() : null,
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id ?? null,
    tx_hash: e.tx_hash ?? null,
    details: e.details ?? null,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Append one audit entry.
 * Pass `client` to make the entry part of the caller's transaction (e.g. a dispense
 * update and its audit row commit together); otherwise it uses its own transaction.
 * entry: { actor_id, actor_wallet, action, entity_type, entity_id, tx_hash, details }
 * `details` must be a plain object (or omitted).
 */
async function recordAudit(entry, client) {
  const own = !client;
  const c = client || (await pool.connect());
  try {
    if (own) await c.query('BEGIN');
    await c.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const last = await c.query('SELECT row_hash FROM audit_log ORDER BY seq DESC LIMIT 1');
    const prev = last.rows[0] ? last.rows[0].row_hash : GENESIS;
    const ts_ms = Date.now();
    const e = { ...entry, actor_wallet: entry.actor_wallet ? entry.actor_wallet.toLowerCase() : null };
    const row_hash = computeHash(prev, { ...e, ts_ms });
    const { rows } = await c.query(
      `INSERT INTO audit_log
         (actor_id, actor_wallet, action, entity_type, entity_id, tx_hash, details, ts_ms, prev_hash, row_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING seq`,
      [e.actor_id ?? null, e.actor_wallet, e.action, e.entity_type, e.entity_id ?? null,
       e.tx_hash ?? null, e.details == null ? null : JSON.stringify(e.details), ts_ms, prev, row_hash],
    );
    if (own) await c.query('COMMIT');
    return rows[0].seq;
  } catch (err) {
    if (own) await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    if (own) c.release();
  }
}

/** Recompute the whole chain. Returns { ok, checked, head } or { ok:false, brokenAtSeq, reason }. */
async function verifyAuditChain() {
  const { rows } = await pool.query(
    `SELECT seq, actor_id, actor_wallet, action, entity_type, entity_id, tx_hash, details,
            ts_ms, prev_hash, row_hash
     FROM audit_log ORDER BY seq ASC`,
  );
  let prev = GENESIS;
  let checked = 0;
  for (const r of rows) {
    if (r.prev_hash.trim() !== prev) {
      return { ok: false, checked, brokenAtSeq: String(r.seq), reason: 'Chain link broken: a row was removed or reordered.' };
    }
    if (computeHash(prev, r) !== r.row_hash.trim()) {
      return { ok: false, checked, brokenAtSeq: String(r.seq), reason: 'Row contents were changed after being written.' };
    }
    prev = r.row_hash.trim();
    checked++;
  }
  return { ok: true, checked, head: prev };
}

module.exports = { recordAudit, verifyAuditChain };
