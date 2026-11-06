const { Contract } = require('ethers');
const pool = require('../config/db');
const { digitalLink } = require('../utils/gs1');
const { buildTree, leafOf } = require('../utils/merkle');
const { getProvider, assertDeployed } = require('../config/chain');

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

const VERDICT = ['not_found', 'authentic', 'pending', 'flagged', 'expired', 'revoked', 'revoked'];

// GET /api/serials/batch/:id/proof?serial=XXXX : proves that one pack belongs to the batch the regulator approved.
// The proof is built from the database and then CHECKED BY THE CONTRACT (verifyPack), so the answer does not rest on this server.
const getSerialProof = async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    const serial = String(req.query.serial || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{6,20}$/.test(serial)) return res.status(400).json({ error: 'Enter the pack serial number (letters and digits).' });

    let scope = null;
    if (req.user.role === 'manufacturer') {
      scope = (await pool.query('SELECT manufacturer_id FROM users WHERE id = $1', [req.user.id])).rows[0]?.manufacturer_id;
      if (!scope) return res.status(403).json({ error: 'Your account is not linked to a manufacturer.' });
    }
    const b = (await pool.query(
      `SELECT id, batch_no, batch_id_hash, serial_root, serial_count, submit_tx_hash
         FROM batches WHERE id = $1 AND status <> 'draft' AND ($2::uuid IS NULL OR manufacturer_id = $2)`, [req.params.id, scope])).rows[0];
    if (!b) return res.status(404).json({ error: 'Batch not found.' });
    if (!b.serial_root) {
      return res.status(200).json({ anchored: false, message: 'This batch was submitted before pack anchoring existed, so its serials have no on-chain root.' });
    }

    const serials = (await pool.query('SELECT serial FROM serials WHERE batch_uuid = $1', [b.id])).rows.map((r) => r.serial);
    const tree = buildTree(b.batch_id_hash, serials);
    const proof = tree.proofFor(serial);
    const out = {
      anchored: true, batchNo: b.batch_no, serial, serialRoot: b.serial_root, serialCount: b.serial_count, submitTxHash: b.submit_tx_hash,
      leaf: leafOf(b.batch_id_hash, serial), inBatch: proof !== null, proof: proof ?? [],
      rootMatchesDatabase: tree.root === b.serial_root, onChain: null,
    };
    if (!out.inBatch) return res.status(200).json({ ...out, message: 'This serial is not one of the packs created for this batch.' });

    // Ask the contract itself. If the node is unreachable the proof is still returned, just without the on-chain answer.
    try {
      const dep = await assertDeployed();
      const c = new Contract(dep.address, dep.abi, getProvider());
      const [verdict, authorised] = await Promise.race([
        c.verifyPack(b.batch_id_hash, serial, proof),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000)),
      ]);
      out.onChain = { serialAuthorised: Boolean(authorised), verdict: VERDICT[Number(verdict)] ?? null, contract: dep.address, chainId: dep.chainId };
    } catch { out.onChain = null; }
    res.status(200).json(out);
  } catch (e) {
    console.error('Error building serial proof:', e.message);
    res.status(500).json({ error: 'Server error while building the pack proof' });
  }
};

module.exports = { listSerials, getSerialProof };
