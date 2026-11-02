const pool = require('../config/db');
const { generatePresignedUrl } = require('../config/storage');
const { recordAudit } = require('../utils/audit');

const TZ = process.env.DISPLAY_TIMEZONE || 'Africa/Kigali';

/* ---------------- pharmacist side (mobile app) ---------------- */

const submitReport = async (req, res) => {
  try {
    const { batch_id, reason, location } = req.body;
    const flagged_by = req.user.id;
    const image_key = req.file ? req.file.key : null; // multer-s3 provides the storage key

    if (!batch_id || !reason || !location) {
      return res.status(400).json({ error: 'Batch ID, reason, and location are required' });
    }
    const newReport = await pool.query(
      `INSERT INTO flag_reports (batch_id, flagged_by, reason, location, image_key)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, batch_id, reason, location, image_key, reported_at`,
      [batch_id, flagged_by, reason, location, image_key],
    );
    const report = newReport.rows[0];
    res.status(201).json({
      message: 'Report submitted successfully',
      report: { ...report, image_url: image_key ? await generatePresignedUrl(image_key) : null },
    });
  } catch (error) {
    console.error('Error submitting report:', error.message);
    res.status(500).json({ error: 'Server error during report submission' });
  }
};

// A pharmacist's own reports. (Previously returned an undefined variable.)
const getReports = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM flag_reports WHERE flagged_by = $1 ORDER BY reported_at DESC`,
      [req.user.id],
    );
    const withUrls = await Promise.all(
      rows.map(async (r) => ({ ...r, image_url: r.image_key ? await generatePresignedUrl(r.image_key) : null })),
    );
    res.status(200).json(withUrls);
  } catch (error) {
    console.error('Error fetching reports:', error.message);
    res.status(500).json({ error: 'Server error while fetching reports' });
  }
};

/* ---------------- regulator side (dashboard) ---------------- */

// Reports store the batch NUMBER as text. Several manufacturers may share a number, so take the
// most recently approved/flagged match for display; the report itself stays the source of truth.
const BATCH_JOIN = `
  LEFT JOIN LATERAL (
    SELECT b.id, b.drug_name, b.status, b.manufacturer_id
    FROM batches b WHERE b.batch_no = fr.batch_id AND b.status <> 'draft'
    ORDER BY b.approved_at DESC NULLS LAST, b.id LIMIT 1
  ) b ON TRUE`;

const stateOf = (status) => (status === 'closed' ? 'closed' : 'under_review');

const listReviewQueue = async (req, res) => {
  try {
    const state = ['under_review', 'closed'].includes(req.query.state) ? req.query.state : 'all';
    const q = String(req.query.q || '').trim().slice(0, 80);
    const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 5, 1), 50);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const where = [];
    const args = [];
    if (state === 'closed') where.push(`fr.status = 'closed'`);
    if (state === 'under_review') where.push(`fr.status <> 'closed'`);
    if (q) {
      args.push(`%${q.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`(fr.batch_id ILIKE $${args.length} OR fr.location ILIKE $${args.length} OR b.drug_name ILIKE $${args.length})`);
    }
    const W = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [metrics, count, rows] = await Promise.all([
      pool.query(`
        SELECT (SELECT COUNT(*)::int FROM flag_reports WHERE status <> 'closed') AS open,
               (SELECT COUNT(*)::int FROM batches WHERE status = 'flagged')       AS flagged_batches,
               (SELECT COUNT(*)::int FROM flag_reports
                  WHERE date_trunc('month', reported_at) = date_trunc('month', (NOW() AT TIME ZONE '${TZ}'))) AS this_month`),
      pool.query(`SELECT COUNT(*)::int AS n FROM flag_reports fr ${BATCH_JOIN} ${W}`, args),
      pool.query(
        `SELECT fr.id, fr.batch_id AS "batchNo", b.drug_name AS drug, fr.reason, fr.location AS sector,
                fr.status, fr.reported_at AS "reportedAt", (fr.image_key IS NOT NULL) AS "hasImage"
         FROM flag_reports fr ${BATCH_JOIN} ${W}
         ORDER BY (fr.status = 'closed'), fr.reported_at DESC
         LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args),
    ]);
    const m = metrics.rows[0];
    res.json({
      metrics: { open: m.open, flaggedBatches: m.flagged_batches, thisMonth: m.this_month },
      total: count.rows[0].n, page, pageSize,
      rows: rows.rows.map((r) => ({ ...r, state: stateOf(r.status) })),
    });
  } catch (e) {
    console.error('listReviewQueue:', e.message);
    res.status(500).json({ error: 'Could not load flag reports' });
  }
};

const getReviewDetail = async (req, res) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Report not found' });
    const { rows } = await pool.query(
      `SELECT fr.id, fr.batch_id AS "batchNo", fr.reason, fr.location AS sector, fr.status,
              fr.reported_at AS "reportedAt", fr.reviewed_at AS "reviewedAt", fr.review_note AS "reviewNote",
              fr.image_key,
              rep.name AS "reporterName", rep.sector AS "reporterSector",
              rev.name AS "reviewerName",
              b.id AS "batchId", b.drug_name AS drug, b.status AS "batchStatus", m.name AS manufacturer
       FROM flag_reports fr
       ${BATCH_JOIN}
       LEFT JOIN manufacturers m ON m.id = b.manufacturer_id
       LEFT JOIN users rep ON rep.id = fr.flagged_by
       LEFT JOIN users rev ON rev.id = fr.reviewed_by
       WHERE fr.id = $1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Report not found' });
    const { image_key, ...r } = rows[0];
    res.json({ ...r, state: stateOf(r.status), imageUrl: image_key ? await generatePresignedUrl(image_key) : null });
  } catch (e) {
    console.error('getReviewDetail:', e.message);
    res.status(500).json({ error: 'Could not load the report' });
  }
};

// Investigation status only. This never changes the batch's on-chain verification status.
const setReviewStatus = async (req, res) => {
  const next = req.body && req.body.status;
  const note = String((req.body && req.body.note) || '').trim();
  if (!['under_review', 'closed'].includes(next)) return res.status(400).json({ error: 'Status must be under_review or closed' });
  if (note.length > 1000) return res.status(400).json({ error: 'Note is too long (1000 characters maximum)' });
  if (next === 'closed' && note.length < 3) return res.status(400).json({ error: 'Add a short note explaining the outcome before closing' });
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Report not found' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cur = await client.query('SELECT id, batch_id, status FROM flag_reports WHERE id = $1 FOR UPDATE', [req.params.id]);
    const r = cur.rows[0];
    if (!r) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Report not found' }); }
    const was = stateOf(r.status);
    if (was === next && r.status === next) { await client.query('ROLLBACK'); return res.status(409).json({ error: `This report is already ${next === 'closed' ? 'closed' : 'under review'}` }); }

    const action = next === 'closed' ? 'report.close' : was === 'closed' ? 'report.reopen' : 'report.review';
    await client.query(
      `UPDATE flag_reports
       SET status = $2, resolved = $3, reviewed_by = $4, reviewed_at = NOW(), review_note = $5
       WHERE id = $1`,
      [r.id, next, next === 'closed', req.user.id, note || null]);
    await recordAudit({
      actor_id: req.user.id, actor_wallet: null, action, entity_type: 'report', entity_id: r.id,
      details: { batchNo: r.batch_id, from: r.status, to: next, note: note || null },
    }, client);
    await client.query('COMMIT');
    res.json({ id: r.id, status: next, state: stateOf(next) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('setReviewStatus:', e.message);
    res.status(500).json({ error: 'Could not update the report' });
  } finally {
    client.release();
  }
};

module.exports = { submitReport, getReports, listReviewQueue, getReviewDetail, setReviewStatus };
