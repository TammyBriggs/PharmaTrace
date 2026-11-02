const pool = require('../config/db');

const TZ = 'Africa/Kigali';
const LOCAL = `((s.scanned_at AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
const TODAY = `date_trunc('day', NOW() AT TIME ZONE '${TZ}')`;
const UUID = /^[0-9a-f-]{36}$/i;
const ISO = (col) => `to_char(${col}, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;

// Counts for one manufacturer. A "drug" is one product (GTIN); a batch is one production run of a drug,
// so a manufacturer with 12 batches of 4 drugs shows 12 and 4. Drafts (never signed on-chain) are ignored.
async function stats(id) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS submitted,
            COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
            COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
            COUNT(*) FILTER (WHERE status = 'flagged')::int  AS flagged,
            COUNT(*) FILTER (WHERE status = 'revoked')::int  AS revoked,
            COUNT(DISTINCT gtin)::int AS drugs,
            COALESCE(SUM(quantity), 0)::bigint AS packs
     FROM batches WHERE manufacturer_id = $1 AND status <> 'draft'`, [id]);
  const s = rows[0];
  return { ...s, packs: Number(s.packs) };
}

const recentBatches = (id, n = 5) => pool.query(
  `SELECT id, batch_no AS "batchNo", drug_name AS drug, status, quantity,
          to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate"
   FROM batches WHERE manufacturer_id = $1 AND status <> 'draft' ORDER BY created_at DESC LIMIT ${n}`, [id]);

// Regulator view of one manufacturer.
const getManufacturerProfile = async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Manufacturer not found' });
    const { rows } = await pool.query(
      `SELECT m.id, m.name, m.license_number AS "licenseNumber", m.wallet_address AS wallet, m.country, m.status,
              m.register_tx_hash AS "registerTxHash", m.revoke_tx_hash AS "revokeTxHash",
              ${ISO('m.created_at')} AS "createdAt", ${ISO('m.approved_at')} AS "approvedAt", ${ISO('m.revoked_at')} AS "revokedAt",
              (SELECT u.contact FROM users u WHERE u.manufacturer_id = m.id ORDER BY u.created_at LIMIT 1) AS contact
       FROM manufacturers m WHERE m.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Manufacturer not found' });
    const [st, recent] = await Promise.all([stats(req.params.id), recentBatches(req.params.id)]);
    res.json({ ...rows[0], stats: st, recentBatches: recent.rows });
  } catch (e) {
    console.error('getManufacturerProfile:', e.message);
    res.status(500).json({ error: 'Could not load this manufacturer' });
  }
};

// A manufacturer's own landing page: their batches, how the public is scanning them, and what needs attention.
const getMyOverview = async (req, res) => {
  try {
    const u = (await pool.query('SELECT manufacturer_id FROM users WHERE id = $1', [req.user.id])).rows[0];
    const id = u && u.manufacturer_id;
    if (!id) return res.status(404).json({ error: 'This account is not linked to a manufacturer.' });

    const [m, st, scans, series, verdicts, attention, expiring, activity] = await Promise.all([
      pool.query(`SELECT name, license_number AS "licenseNumber", status, country FROM manufacturers WHERE id = $1`, [id]),
      stats(id),
      pool.query(`SELECT COUNT(*) FILTER (WHERE ${LOCAL} >= ${TODAY})::int AS today,
                         COUNT(*) FILTER (WHERE ${LOCAL} >= ${TODAY} - interval '6 days')::int AS week,
                         COUNT(DISTINCT s.sector) FILTER (WHERE ${LOCAL} >= ${TODAY} - interval '6 days')::int AS sectors
                  FROM scan_events s JOIN batches b ON b.id = s.batch_uuid WHERE b.manufacturer_id = $1`, [id]),
      pool.query(`WITH t AS (SELECT (NOW() AT TIME ZONE '${TZ}')::date AS d)
                  SELECT to_char(g::date, 'YYYY-MM-DD') AS date, COALESCE(c.n, 0)::int AS count
                  FROM t, generate_series(t.d::timestamp - interval '13 days', t.d::timestamp, interval '1 day') g
                  LEFT JOIN (SELECT ${LOCAL}::date AS day, COUNT(*) AS n
                             FROM scan_events s JOIN batches b ON b.id = s.batch_uuid
                             WHERE b.manufacturer_id = $1 AND s.scanned_at >= NOW() - interval '16 days' GROUP BY 1) c ON c.day = g::date
                  ORDER BY g`, [id]),
      pool.query(`SELECT s.verdict, COUNT(*)::int AS n FROM scan_events s JOIN batches b ON b.id = s.batch_uuid
                  WHERE b.manufacturer_id = $1 AND ${LOCAL} >= ${TODAY} - interval '29 days' GROUP BY s.verdict`, [id]),
      pool.query(`SELECT id, batch_no AS "batchNo", drug_name AS drug, status,
                         (SELECT reason FROM batch_events e WHERE e.batch_uuid = batches.id AND e.event IN ('flagged','revoked') ORDER BY e.created_at DESC LIMIT 1) AS reason
                  FROM batches WHERE manufacturer_id = $1 AND status IN ('flagged','revoked') ORDER BY created_at DESC LIMIT 5`, [id]),
      pool.query(`SELECT id, batch_no AS "batchNo", drug_name AS drug, to_char(expiry_date, 'YYYY-MM-DD') AS "expiryDate",
                         (expiry_date - (NOW() AT TIME ZONE '${TZ}')::date)::int AS days
                  FROM batches WHERE manufacturer_id = $1 AND status = 'approved'
                    AND expiry_date >= (NOW() AT TIME ZONE '${TZ}')::date AND expiry_date <= (NOW() AT TIME ZONE '${TZ}')::date + 90
                  ORDER BY expiry_date LIMIT 5`, [id]),
      pool.query(`SELECT e.event, e.reason, ${ISO('e.created_at')} AS at, b.batch_no AS "batchNo", b.drug_name AS drug, b.id AS "batchId"
                  FROM batch_events e JOIN batches b ON b.id = e.batch_uuid WHERE b.manufacturer_id = $1
                  ORDER BY e.created_at DESC LIMIT 6`, [id]),
    ]);

    const counts = Object.fromEntries(verdicts.rows.map((r) => [r.verdict, r.n]));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    res.json({
      manufacturer: m.rows[0], stats: st,
      scans: { today: scans.rows[0].today, week: scans.rows[0].week, sectors: scans.rows[0].sectors, points: series.rows },
      verdicts: { ...counts, total },
      attention: { flagged: attention.rows, expiring: expiring.rows },
      activity: activity.rows,
    });
  } catch (e) {
    console.error('getMyOverview:', e.message);
    res.status(500).json({ error: 'Could not load your overview' });
  }
};

module.exports = { getManufacturerProfile, getMyOverview };
