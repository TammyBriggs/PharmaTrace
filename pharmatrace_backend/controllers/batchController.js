const { ethers } = require('ethers');
const pool = require('../config/db');
const { getProvider, assertDeployed } = require('../config/chain');
const { recordAudit } = require('../utils/audit');
const { deriveGtin, isValidGtin, randomSerial, digitalLink } = require('../utils/gs1');

const PAGE_SIZE = 6;
const MAX_QUANTITY = 50000;
const TX = /^0x[0-9a-fA-F]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH_NO = /^[A-Z0-9][A-Z0-9\-/]{2,39}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Shared with the dashboard dropdown (served by GET /batches/context).
const REASONS = ['Packaging mismatch', 'Suspected counterfeit', 'Quality defect', 'Failed laboratory test',
  'Unauthorised distribution', 'Manufacturer recall', 'Other'];

const fail = (status, message) => Object.assign(new Error(message), { status });
const send = (res, e, label) => {
  if (!e.status) console.error(`Error in ${label}:`, e.message);
  res.status(e.status || 500).json({ error: e.status ? e.message : `Server error (${label})` });
};

// The same formula runs in the browser before the wallet signs: keccak256("<reason>\n<notes>").
const reasonHashOf = (reason, notes) => ethers.id(`${reason.trim()}\n${notes.trim()}`);
const batchIdOf = (wallet, batchNo) =>
  ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['address', 'string'], [wallet, batchNo]));
const unix = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 1000);

function addMonths(day, n) {
  const [y, m, d] = day.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}
const validDay = (s) => DAY.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// ───────────────────────── shapes ─────────────────────────
const LIST_COLS = `b.id, b.batch_no, b.drug_name, b.category, b.quantity, b.status, b.manufacturer_id,
  to_char(b.expiry_date, 'YYYY-MM-DD') AS expiry_date, m.name AS manufacturer_name,
  p.brand_name, p.strength, p.dosage_form`;
const listItem = (r) => ({
  id: r.id, batchNo: r.batch_no, drugName: r.drug_name, brandName: r.brand_name ?? null, strength: r.strength ?? null,
  dosageForm: r.dosage_form ?? null, category: r.category, quantity: r.quantity, status: r.status,
  manufacturerName: r.manufacturer_name, expiryDate: r.expiry_date,
  expired: r.status === 'approved' && r.expiry_date < new Date().toISOString().slice(0, 10),
});

async function scopeManufacturerId(user) {
  if (user.role !== 'manufacturer') return null;               // regulator / super_admin see everything
  const r = (await pool.query('SELECT manufacturer_id FROM users WHERE id = $1', [user.id])).rows[0];
  if (!r?.manufacturer_id) throw fail(403, 'Your account is not linked to a manufacturer.');
  return r.manufacturer_id;
}

/** The manufacturer a signed-in user submits batches as (manufacturer role: own; super_admin: row with its wallet). */
async function submitterManufacturer(user) {
  const u = (await pool.query('SELECT wallet_address, manufacturer_id FROM users WHERE id = $1', [user.id])).rows[0];
  if (!u?.wallet_address) throw fail(400, 'Your account has no wallet linked, so it cannot sign on-chain actions.');
  const q = user.role === 'manufacturer'
    ? await pool.query('SELECT * FROM manufacturers WHERE id = $1', [u.manufacturer_id])
    : await pool.query('SELECT * FROM manufacturers WHERE wallet_address = $1', [u.wallet_address.toLowerCase()]);
  const mf = q.rows[0];
  if (!mf) throw fail(403, user.role === 'manufacturer' ? 'Your account is not linked to a manufacturer.' : 'No manufacturer is registered for your wallet.');
  if (mf.status !== 'active') throw fail(403, 'This manufacturer is not approved on-chain, so it cannot submit batches.');
  if (mf.wallet_address.toLowerCase() !== u.wallet_address.toLowerCase()) throw fail(403, 'Your linked wallet does not match the manufacturer’s registered wallet.');
  return { mf, wallet: u.wallet_address.toLowerCase() };
}

async function actorWallet(userId) {
  const w = (await pool.query('SELECT wallet_address FROM users WHERE id = $1', [userId])).rows[0]?.wallet_address;
  if (!w) throw fail(400, 'Your account has no wallet linked, so it cannot sign on-chain actions.');
  return w.toLowerCase();
}

/** Reads a mined receipt and returns the PharmaTrace events in it. */
async function readTx(txHash) {
  const dep = await assertDeployed();
  let receipt, block;
  try {
    receipt = await getProvider().getTransactionReceipt(txHash);
    if (receipt) block = await getProvider().getBlock(receipt.blockNumber);
  } catch { throw fail(502, 'Could not read the transaction from the blockchain node.'); }
  if (!receipt) throw fail(409, 'The transaction has not been mined yet. Try again in a moment.');
  if (receipt.status !== 1) throw fail(400, 'That transaction failed on-chain.');
  const events = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== dep.address.toLowerCase()) continue;
    try { const p = dep.iface.parseLog(log); if (p) events.push(p); } catch { /* not ours */ }
  }
  return { receipt, block, events };
}

// ───────────────────────── GET /batches/context ─────────────────────────
const getContext = async (req, res) => {
  try {
    let manufacturer = null, canSubmit = false, reason = null;
    if (req.user.role === 'manufacturer' || req.user.role === 'super_admin') {
      try { const { mf } = await submitterManufacturer(req.user); manufacturer = { id: mf.id, name: mf.name, wallet: mf.wallet_address }; canSubmit = true; }
      catch (e) { if (!e.status) throw e; reason = e.message; }
    }
    res.status(200).json({ canSubmit, reason, manufacturer, reasons: REASONS, maxQuantity: MAX_QUANTITY });
  } catch (e) { send(res, e, 'batch context'); }
};

// ───────────────────────── GET /batches ─────────────────────────
const listBatches = async (req, res) => {
  try {
    const scope = await scopeManufacturerId(req.user);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = String(req.query.search || '').trim().slice(0, 80);
    const like = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;
    const status = ['pending', 'approved', 'flagged', 'revoked'].includes(req.query.status) ? req.query.status : null;

    const [rows, counts] = await Promise.all([
      pool.query(
        `SELECT ${LIST_COLS}, COUNT(*) OVER()::int AS total
           FROM batches b JOIN manufacturers m ON m.id = b.manufacturer_id LEFT JOIN products p ON p.id = b.product_id
          WHERE b.status <> 'draft' AND ($1::uuid IS NULL OR b.manufacturer_id = $1)
            AND ($2::text IS NULL OR b.batch_no ILIKE $2 OR b.drug_name ILIKE $2 OR m.name ILIKE $2 OR p.brand_name ILIKE $2)
            AND ($3::text IS NULL OR b.status = $3)
          ORDER BY (b.status = 'pending') DESC, b.created_at DESC LIMIT $4 OFFSET $5`,
        [scope, like, status, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
      pool.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE status='pending')::int  AS pending,
                COUNT(*) FILTER (WHERE status='approved')::int AS approved,
                COUNT(*) FILTER (WHERE status='flagged')::int  AS flagged,
                COUNT(*) FILTER (WHERE status='revoked')::int  AS revoked
           FROM batches WHERE status <> 'draft' AND ($1::uuid IS NULL OR manufacturer_id = $1)`, [scope]),
    ]);
    res.status(200).json({ items: rows.rows.map(listItem), total: rows.rows[0]?.total ?? 0, page, pageSize: PAGE_SIZE, counts: counts.rows[0] });
  } catch (e) { send(res, e, 'list batches'); }
};

// ───────────────────────── GET /batches/:id ─────────────────────────
async function loadDetail(id, scope) {
  const b = (await pool.query(
    `SELECT b.*, to_char(b.mfg_date,'YYYY-MM-DD') AS mfg_day, to_char(b.expiry_date,'YYYY-MM-DD') AS expiry_day,
            m.name AS manufacturer_name, m.license_number, m.wallet_address AS manufacturer_wallet,
            p.registration_number, p.brand_name, p.generic_name, p.strength, p.dosage_form, p.pack_size
       FROM batches b JOIN manufacturers m ON m.id = b.manufacturer_id LEFT JOIN products p ON p.id = b.product_id
      WHERE b.id = $1 AND b.status <> 'draft'`, [id])).rows[0];
  if (!b || (scope && b.manufacturer_id !== scope)) throw fail(404, 'Batch not found.');
  const [events, serials, scans] = await Promise.all([
    pool.query(`SELECT e.event, e.tx_hash, e.reason, e.notes, e.actor_wallet, u.name AS actor_name,
                       to_char(e.block_time,'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS at
                  FROM batch_events e LEFT JOIN users u ON u.id = e.actor_id WHERE e.batch_uuid = $1 ORDER BY e.block_time, e.created_at`, [id]),
    pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status='active')::int AS active,
                       COUNT(*) FILTER (WHERE status='dispensed')::int AS dispensed, COUNT(*) FILTER (WHERE status='revoked')::int AS revoked
                  FROM serials WHERE batch_uuid = $1`, [id]),
    pool.query(`SELECT COALESCE(sector,'Unknown') AS sector, COUNT(*)::int AS scans,
                       to_char(MAX(scanned_at),'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_at
                  FROM scan_events WHERE batch_uuid = $1 AND scanned_at > now() - interval '30 days'
                 GROUP BY 1 ORDER BY scans DESC LIMIT 5`, [id]),
  ]);
  return {
    id: b.id, batchNo: b.batch_no, status: b.status, gtin: b.gtin, drugName: b.drug_name, category: b.category,
    brandName: b.brand_name, genericName: b.generic_name, strength: b.strength, dosageForm: b.dosage_form, packSize: b.pack_size,
    registrationNumber: b.registration_number, quantity: b.quantity, mfgDate: b.mfg_day, expiryDate: b.expiry_day,
    expired: b.status === 'approved' && b.expiry_day < new Date().toISOString().slice(0, 10),
    manufacturer: { id: b.manufacturer_id, name: b.manufacturer_name, licenseNumber: b.license_number, wallet: b.manufacturer_wallet },
    batchIdHash: b.batch_id_hash, submitTxHash: b.submit_tx_hash,
    flag: b.flag_reason ? { reason: b.flag_reason, notes: b.flag_notes, txHash: b.flag_tx_hash } : null,
    revoke: b.revoke_reason ? { reason: b.revoke_reason, notes: b.revoke_notes, txHash: b.revoke_tx_hash } : null,
    link: digitalLink(b.gtin, b.batch_no),
    events: events.rows.map((e) => ({ event: e.event, txHash: e.tx_hash, reason: e.reason, notes: e.notes, wallet: e.actor_wallet, actor: e.actor_name, at: e.at })),
    serials: serials.rows[0],
    scans: { total: scans.rows.reduce((s, r) => s + r.scans, 0), bySector: scans.rows.map((r) => ({ sector: r.sector, scans: r.scans, lastAt: r.last_at })) },
  };
}
const getBatch = async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) throw fail(404, 'Batch not found.');
    res.status(200).json({ batch: await loadDetail(req.params.id, await scopeManufacturerId(req.user)) });
  } catch (e) { send(res, e, 'get batch'); }
};

// ───────────────────────── POST /batches  (step 1: save as draft, return what to sign) ─────────────────────────
const prepareBatch = async (req, res) => {
  try {
    const { mf, wallet } = await submitterManufacturer(req.user);
    const batchNo = String(req.body.batchNo || '').trim().toUpperCase();
    const mfgDate = String(req.body.mfgDate || '');
    const quantity = Number(req.body.quantity);
    if (!UUID.test(String(req.body.productId || ''))) throw fail(400, 'Choose a product from the catalogue.');
    if (!BATCH_NO.test(batchNo)) throw fail(400, 'Batch number must be 3–40 characters: letters, digits, "-" or "/".');
    if (!validDay(mfgDate)) throw fail(400, 'Enter a valid manufacture date.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw fail(400, `Quantity must be a whole number from 1 to ${MAX_QUANTITY.toLocaleString('en-US')}.`);

    const p = (await pool.query('SELECT * FROM products WHERE id = $1', [req.body.productId])).rows[0];
    if (!p) throw fail(400, 'That product is not in the catalogue.');
    const today = new Date().toISOString().slice(0, 10);
    if (mfgDate > today) throw fail(400, 'The manufacture date cannot be in the future.');
    const expiryDate = addMonths(mfgDate, p.shelf_life_months);
    if (expiryDate <= today) throw fail(400, 'This batch would already be expired. Check the manufacture date.');

    const gtin = req.body.gtin ? String(req.body.gtin).trim() : deriveGtin(p.registration_number);
    if (!isValidGtin(gtin)) throw fail(400, 'GTIN must be 14 digits with a valid check digit.');

    const metadataHash = ethers.id(JSON.stringify([gtin, batchNo, p.registration_number, p.brand_name, p.generic_name,
      p.strength, p.dosage_form, p.pack_size, quantity, mfgDate, expiryDate]));
    const batchIdHash = batchIdOf(wallet, batchNo);
    const drugName = `${p.generic_name} ${p.strength}`.slice(0, 150);

    const { rows } = await pool.query(
      `INSERT INTO batches (manufacturer_id, batch_no, gtin, drug_name, category, mfg_date, expiry_date, quantity,
                            batch_id_hash, metadata_hash, status, created_by, product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$12)
       ON CONFLICT (manufacturer_id, batch_no) DO UPDATE SET gtin=$3, drug_name=$4, category=$5, mfg_date=$6, expiry_date=$7,
         quantity=$8, batch_id_hash=$9, metadata_hash=$10, created_by=$11, product_id=$12
         WHERE batches.status = 'draft'
       RETURNING id`,
      [mf.id, batchNo, gtin, drugName, p.category, mfgDate, expiryDate, quantity, batchIdHash, metadataHash, req.user.id, p.id]);
    if (!rows.length) throw fail(409, `Batch ${batchNo} already exists for this manufacturer.`);

    res.status(201).json({ id: rows[0].id, chain: { batchNo, metadataHash, mfgDate: unix(mfgDate), expiryDate: unix(expiryDate) },
      summary: { drugName, gtin, expiryDate, quantity } });
  } catch (e) { send(res, e, 'prepare batch'); }
};

// ───────────────────────── POST /batches/:id/confirm-submit ─────────────────────────
async function addSerials(client, batchUuid, quantity) {
  let have = 0;
  for (let guard = 0; guard < 20 && have < quantity; guard++) {
    const need = quantity - have;
    const chunk = Array.from({ length: Math.min(need, 5000) }, () => randomSerial());
    await client.query('INSERT INTO serials (batch_uuid, serial) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [batchUuid, chunk]);
    have = (await client.query('SELECT COUNT(*)::int AS n FROM serials WHERE batch_uuid = $1', [batchUuid])).rows[0].n;
  }
  if (have < quantity) throw fail(500, 'Could not generate unique serial numbers.');
}

const confirmSubmit = async (req, res) => {
  const client = await pool.connect();
  try {
    const txHash = String(req.body.txHash || '');
    if (!TX.test(txHash)) throw fail(400, 'A valid transaction hash is required.');
    if (!UUID.test(req.params.id)) throw fail(404, 'Batch not found.');
    const { mf, wallet } = await submitterManufacturer(req.user);
    const b0 = (await pool.query('SELECT * FROM batches WHERE id = $1 AND manufacturer_id = $2', [req.params.id, mf.id])).rows[0];
    if (!b0) throw fail(404, 'Batch not found.');
    if (b0.status !== 'draft') {
      if (b0.submit_tx_hash === txHash) return res.status(200).json({ batch: await loadDetail(b0.id, null) }); // replay
      throw fail(409, 'This batch has already been submitted.');
    }

    const { events, block } = await readTx(txHash);
    const ok = events.some((e) => e.name === 'BatchSubmitted' && e.args.batchId === b0.batch_id_hash
      && e.args.manufacturer.toLowerCase() === wallet && e.args.metadataHash === b0.metadata_hash);
    if (!ok) throw fail(400, 'That transaction does not match this batch and your wallet.');

    await client.query('BEGIN');
    const b = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [b0.id])).rows[0];
    if (b.status !== 'draft') { await client.query('ROLLBACK'); return res.status(200).json({ batch: await loadDetail(b.id, null) }); }
    await client.query(`UPDATE batches SET status='pending', submit_tx_hash=$2 WHERE id=$1`, [b.id, txHash]);
    await client.query(`INSERT INTO batch_events (batch_uuid, event, actor_id, actor_wallet, tx_hash, block_time)
                        VALUES ($1,'submitted',$2,$3,$4,to_timestamp($5) AT TIME ZONE 'UTC')`, [b.id, req.user.id, wallet, txHash, block.timestamp]);
    await addSerials(client, b.id, b.quantity);
    await recordAudit({ actor_id: req.user.id, actor_wallet: wallet, action: 'batch.submit', entity_type: 'batch', entity_id: b.id, tx_hash: txHash,
      details: { batchNo: b.batch_no, drug: b.drug_name, quantity: b.quantity, manufacturer: mf.name } }, client);
    await client.query('COMMIT');
    res.status(200).json({ batch: await loadDetail(b.id, null) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    send(res, e, 'confirm submit');
  } finally { client.release(); }
};

// ───────────────────────── POST /batches/:id/confirm-action (regulator) ─────────────────────────
// event name on-chain -> [batch_events.event, audit action, statuses it may start from]
const ACTIONS = {
  BatchApproved:     ['approved', 'batch.approve', ['pending']],
  BatchFlagged:      ['flagged', 'batch.flag', ['pending', 'approved']],
  BatchFlagResolved: ['flag_resolved', 'batch.flag_resolve', ['flagged']],
  BatchRevoked:      ['revoked', 'batch.revoke', ['pending', 'approved', 'flagged']],
  BatchReinstated:   ['reinstated', 'batch.reinstate', ['revoked']],
};

const confirmAction = async (req, res) => {
  const client = await pool.connect();
  try {
    const txHash = String(req.body.txHash || '');
    if (!TX.test(txHash)) throw fail(400, 'A valid transaction hash is required.');
    if (!UUID.test(req.params.id)) throw fail(404, 'Batch not found.');
    const wallet = await actorWallet(req.user.id);
    const b0 = (await pool.query(`SELECT * FROM batches WHERE id = $1 AND status <> 'draft'`, [req.params.id])).rows[0];
    if (!b0) throw fail(404, 'Batch not found.');

    const done = (await pool.query('SELECT 1 FROM batch_events WHERE tx_hash = $1 AND batch_uuid = $2', [txHash, b0.id])).rows[0];
    if (done) return res.status(200).json({ batch: await loadDetail(b0.id, null), totals: await totals() }); // replay

    const { events, block } = await readTx(txHash);
    const ev = events.find((e) => ACTIONS[e.name] && e.args.batchId === b0.batch_id_hash && e.args.regulator.toLowerCase() === wallet);
    if (!ev) throw fail(400, 'That transaction does not match this batch and your wallet.');
    const [eventName, action, from] = ACTIONS[ev.name];

    let reason = null, notes = null;
    if (ev.name === 'BatchFlagged' || ev.name === 'BatchRevoked') {
      reason = String(req.body.reason || '').trim(); notes = String(req.body.notes || '').trim();
      if (!REASONS.includes(reason)) throw fail(400, 'Choose a valid reason.');
      if (notes.length < 10 || notes.length > 1000) throw fail(400, 'Notes must be 10 to 1000 characters.');
      if (ev.args.reasonHash !== reasonHashOf(reason, notes)) throw fail(400, 'The reason you sent does not match what was signed on-chain.');
    }

    await client.query('BEGIN');
    const b = (await client.query('SELECT * FROM batches WHERE id = $1 FOR UPDATE', [b0.id])).rows[0];
    if (!from.includes(b.status)) throw fail(409, `This batch is ${b.status}; that action no longer applies.`);

    const restore = b.approved_at ? 'approved' : 'pending';   // mirrors the contract's resolveFlag / reinstate
    const ts = `to_timestamp($2) AT TIME ZONE 'UTC'`;
    const upd = {
      BatchApproved:     [`UPDATE batches SET status='approved', approve_tx_hash=$3, approved_at=${ts} WHERE id=$1`, [b.id, block.timestamp, txHash]],
      BatchFlagged:      [`UPDATE batches SET status='flagged', flag_reason=$3, flag_notes=$4, flag_tx_hash=$5, flagged_at=${ts} WHERE id=$1`, [b.id, block.timestamp, reason, notes, txHash]],
      BatchFlagResolved: [`UPDATE batches SET status=$3 WHERE id=$1 AND $2::bigint IS NOT NULL`, [b.id, block.timestamp, restore]],
      BatchRevoked:      [`UPDATE batches SET status='revoked', revoke_reason=$3, revoke_notes=$4, revoke_tx_hash=$5, revoked_at=${ts} WHERE id=$1`, [b.id, block.timestamp, reason, notes, txHash]],
      BatchReinstated:   [`UPDATE batches SET status=$3 WHERE id=$1 AND $2::bigint IS NOT NULL`, [b.id, block.timestamp, restore]],
    }[ev.name];
    await client.query(upd[0], upd[1]);
    await client.query(`INSERT INTO batch_events (batch_uuid, event, actor_id, actor_wallet, tx_hash, reason, notes, block_time)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,to_timestamp($8) AT TIME ZONE 'UTC')`,
      [b.id, eventName, req.user.id, wallet, txHash, reason, notes, block.timestamp]);
    await recordAudit({ actor_id: req.user.id, actor_wallet: wallet, action, entity_type: 'batch', entity_id: b.id, tx_hash: txHash,
      details: { batchNo: b.batch_no, from: b.status, ...(reason ? { reason } : {}) } }, client);
    await client.query('COMMIT');
    res.status(200).json({ batch: await loadDetail(b.id, null), totals: await totals() });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    send(res, e, 'confirm batch action');
  } finally { client.release(); }
};

async function totals() {
  return (await pool.query(`SELECT COUNT(*) FILTER (WHERE status='pending')::int AS pending, COUNT(*) FILTER (WHERE status='approved')::int AS approved,
    COUNT(*) FILTER (WHERE status='flagged')::int AS flagged, COUNT(*) FILTER (WHERE status='revoked')::int AS revoked FROM batches WHERE status <> 'draft'`)).rows[0];
}

module.exports = { getContext, listBatches, getBatch, prepareBatch, confirmSubmit, confirmAction, reasonHashOf, batchIdOf, addMonths, REASONS };
