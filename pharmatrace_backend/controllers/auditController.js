const pool = require('../config/db');
const { verifyAuditChain } = require('../utils/audit');

const TZ = 'Africa/Kigali';
const WHEN = `(to_timestamp(a.ts_ms / 1000.0) AT TIME ZONE '${TZ}')`;
const TODAY = `date_trunc('day', NOW() AT TIME ZONE '${TZ}')`;

// The log page shows regulator decisions. Manufacturer submissions live in the batch timeline and
// per-pack dispenses are high-volume, so both are left out of the list (they are still in the chain).
const HIDDEN = ['batch.submit', 'serial.dispense'];
const GROUPS = {
  approvals: ['batch.approve', 'batch.reinstate', 'manufacturer.register'],
  flags: ['batch.flag', 'batch.flag_resolve', 'batch.revoke', 'manufacturer.revoke', 'report.review', 'report.close', 'report.reopen'],
};
const DAYS = { today: 0, '7d': 6, '30d': 29 };

const listAudit = async (req, res) => {
  try {
    const group = GROUPS[req.query.group] ? req.query.group : 'all';
    const range = req.query.range in DAYS ? req.query.range : 'all';
    const q = String(req.query.q || '').trim().slice(0, 80);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 6, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const args = [HIDDEN];
    const where = [`NOT (a.action = ANY($1))`];
    if (group !== 'all') { args.push(GROUPS[group]); where.push(`a.action = ANY($${args.length})`); }
    if (range !== 'all') where.push(`${WHEN} >= ${TODAY} - interval '${DAYS[range]} days'`);
    if (q) {
      args.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      const p = `$${args.length}`;
      where.push(`(u.name ILIKE ${p} OR a.details->>'batchNo' ILIKE ${p} OR a.details->>'name' ILIKE ${p} OR a.tx_hash ILIKE ${p})`);
    }
    const W = `WHERE ${where.join(' AND ')}`;
    const FROM = `FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${W}`;

    const [count, rows] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS n ${FROM}`, args),
      pool.query(
        `SELECT a.seq::text AS seq, a.ts_ms::text AS "tsMs", COALESCE(u.name, 'System') AS actor, a.action,
                a.entity_type AS "entityType", a.entity_id AS "entityId",
                COALESCE(a.details->>'batchNo', a.details->>'name') AS subject,
                a.tx_hash AS "txHash", a.row_hash AS "rowHash"
         ${FROM} ORDER BY a.seq DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args),
    ]);
    res.json({ total: count.rows[0].n, page, pageSize, rows: rows.rows.map((r) => ({ ...r, rowHash: r.rowHash.trim() })) });
  } catch (e) {
    console.error('listAudit:', e.message);
    res.status(500).json({ error: 'Could not load the audit log' });
  }
};

// Recomputes the whole hash chain (every entry, including submissions and dispenses).
const verifyChain = async (req, res) => {
  try {
    const r = await verifyAuditChain();
    const total = (await pool.query('SELECT COUNT(*)::int AS n FROM audit_log')).rows[0].n;
    res.json({ ...r, total, verifiedAt: new Date().toISOString() });
  } catch (e) {
    console.error('verifyChain:', e.message);
    res.status(500).json({ error: 'Could not verify the audit chain' });
  }
};

module.exports = { listAudit, verifyChain };
