const pool = require('../config/db');

const MIN = 2;
const EVENT_LABEL = { submitted: 'Submitted batch', approved: 'Approved batch', flagged: 'Flagged batch', flag_resolved: 'Resolved flag', revoked: 'Revoked batch', reinstated: 'Reinstated batch' };
const short = (h) => `${h.slice(0, 6)}…${h.slice(-4)}`;
const esc = (s) => s.replace(/[%_\\]/g, '\\$&');

// Typeahead for the header search. Regulators search batches, manufacturers and transactions;
// a manufacturer only ever sees its own batches and the transactions on them.
const search = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 80);
    if (q.length < MIN) return res.json({ query: q, results: [] });

    const isMfr = req.user.role === 'manufacturer';
    let mid = null;
    if (isMfr) {
      mid = (await pool.query('SELECT manufacturer_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.manufacturer_id;
      if (!mid) return res.json({ query: q, results: [] });
    }
    const like = `%${esc(q)}%`;
    const starts = `${esc(q)}%`;
    const scope = isMfr ? 'AND b.manufacturer_id = $3' : '';
    const sArgs = isMfr ? [like, starts, mid] : [like, starts];

    const hashQ = q.replace(/^0x/i, '');
    const wantTx = hashQ.length >= 3 && /^[0-9a-f]+$/i.test(hashQ);
    const txLike = `%${esc(hashQ.toLowerCase())}%`;

    const [batches, mfrs, txs] = await Promise.all([
      pool.query(
        `SELECT b.id, b.batch_no, b.drug_name, b.status, m.name AS manufacturer
         FROM batches b JOIN manufacturers m ON m.id = b.manufacturer_id
         WHERE b.status <> 'draft' AND (b.batch_no ILIKE $1 OR b.drug_name ILIKE $1) ${scope}
         ORDER BY (b.batch_no ILIKE $2) DESC, (b.drug_name ILIKE $2) DESC, b.batch_no LIMIT 4`, sArgs),
      isMfr ? { rows: [] } : pool.query(
        `SELECT id, name, license_number, status FROM manufacturers
         WHERE name ILIKE $1 OR license_number ILIKE $1
         ORDER BY (name ILIKE $2) DESC, name LIMIT 3`, [like, starts]),
      !wantTx ? { rows: [] } : pool.query(
        `SELECT * FROM (
           SELECT be.tx_hash, be.event AS label_key, b.id AS batch_id, b.batch_no, NULL::uuid AS manufacturer_id, NULL AS mname, be.created_at AS at
           FROM batch_events be JOIN batches b ON b.id = be.batch_uuid
           WHERE lower(be.tx_hash) LIKE $1 ${scope.replace('$3', '$2')}
           ${isMfr ? '' : `UNION ALL
           SELECT m.register_tx_hash, 'registered', NULL, NULL, m.id, m.name, m.created_at FROM manufacturers m WHERE lower(m.register_tx_hash) LIKE $1
           UNION ALL
           SELECT m.revoke_tx_hash, 'mrevoked', NULL, NULL, m.id, m.name, m.created_at FROM manufacturers m WHERE lower(m.revoke_tx_hash) LIKE $1`}
         ) t ORDER BY t.at DESC LIMIT 3`, isMfr ? [txLike, mid] : [txLike]),
    ]);

    const results = [
      ...batches.rows.map((r) => ({
        type: 'batch', id: r.id, title: r.batch_no,
        subtitle: `${r.drug_name}${isMfr ? '' : ` · ${r.manufacturer}`} · ${r.status[0].toUpperCase()}${r.status.slice(1)}`,
        target: { type: 'batch', id: r.id },
      })),
      ...mfrs.rows.map((r) => ({
        type: 'manufacturer', id: r.id, title: r.name,
        subtitle: `${r.license_number} · ${r.status[0].toUpperCase()}${r.status.slice(1)}`,
        target: { type: 'manufacturer', id: r.id },
      })),
      ...txs.rows.map((r) => ({
        type: 'transaction', id: r.tx_hash, title: short(r.tx_hash),
        subtitle: r.batch_no ? `${EVENT_LABEL[r.label_key] ?? r.label_key} · ${r.batch_no}`
          : `${r.label_key === 'registered' ? 'Registered' : 'Revoked'} manufacturer · ${r.mname}`,
        target: r.batch_id ? { type: 'batch', id: r.batch_id } : { type: 'manufacturer', id: r.manufacturer_id },
      })),
    ];
    res.json({ query: q, results });
  } catch (e) {
    console.error('search:', e.message);
    res.status(500).json({ error: 'Search is unavailable right now' });
  }
};

module.exports = { search };
