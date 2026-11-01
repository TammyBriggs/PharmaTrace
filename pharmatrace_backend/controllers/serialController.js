const pool = require('../config/db');
const { digitalLink } = require('../utils/gs1');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/serials/batch/:id?page=  : the per-pack codes for the print sheet (regulators: any batch; manufacturers: their own).
const listSerials = async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    let scope = null;
    if (req.user.role === 'manufacturer') {
      scope = (await pool.query('SELECT manufacturer_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.manufacturer_id;
      if (!scope) return res.status(403).json({ error: 'Your account is not linked to a manufacturer.' });
    }
    const b = (await pool.query(
      `SELECT b.id, b.batch_no, b.gtin, b.drug_name, b.status, to_char(b.expiry_date,'YYYY-MM-DD') AS expiry_day, m.name AS manufacturer_name
         FROM batches b JOIN manufacturers m ON m.id = b.manufacturer_id
        WHERE b.id = $1 AND b.status <> 'draft' AND ($2::uuid IS NULL OR b.manufacturer_id = $2)`, [req.params.id, scope])).rows[0];
    if (!b) return res.status(404).json({ error: 'Batch not found.' });

    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 48, 1), 120);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const [rows, counts] = await Promise.all([
      pool.query('SELECT serial, status FROM serials WHERE batch_uuid = $1 ORDER BY serial LIMIT $2 OFFSET $3', [b.id, pageSize, (page - 1) * pageSize]),
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='dispensed')::int AS dispensed FROM serials WHERE batch_uuid = $1`, [b.id]),
    ]);
    res.status(200).json({
      batch: { id: b.id, batchNo: b.batch_no, drugName: b.drug_name, gtin: b.gtin, status: b.status, expiryDate: b.expiry_day, manufacturerName: b.manufacturer_name },
      items: rows.rows.map((r) => ({ serial: r.serial, status: r.status, link: digitalLink(b.gtin, b.batch_no, r.serial) })),
      total: counts.rows[0].total, dispensed: counts.rows[0].dispensed, page, pageSize,
    });
  } catch (e) {
    console.error('Error listing serials:', e.message);
    res.status(500).json({ error: 'Server error while loading pack codes' });
  }
};
module.exports = { listSerials };
