const { ethers } = require('ethers');
const pool = require('../config/db');
const { getProvider, assertDeployed } = require('../config/chain');
const { recordAudit } = require('../utils/audit');

const COUNTRIES = ['Rwanda', 'Kenya', 'Uganda', 'Tanzania', 'Burundi', 'DR Congo', 'Ethiopia',
  'South Africa', 'Egypt', 'India', 'China', 'Other'];
const PAGE_SIZE = 6;
const TX = /^0x[0-9a-fA-F]{64}$/;
const LICENCE = /^[A-Z0-9][A-Z0-9\-/ ]{2,79}$/;

const licenseHash = (licence) => ethers.id(licence); // keccak256 of the normalised licence number

const toApi = (r) => ({
  id: r.id, name: r.name, licenseNumber: r.license_number, wallet: r.wallet_address,
  country: r.country, status: r.status, approvedDate: r.approved_date ?? null,
  registerTxHash: r.register_tx_hash ?? null,
});

const COLS = `id, name, license_number, wallet_address, country, status, register_tx_hash,
  to_char((approved_at AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Kigali', 'YYYY-MM-DD') AS approved_date`;

const listManufacturers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = String(req.query.search || '').trim().slice(0, 80);
    const like = search ? `%${search.replace(/[\\%_]/g, '\\$&')}%` : null;
    const wanted = { approved: 'active', pending: 'pending', revoked: 'revoked' }[req.query.status] ?? null;

    const [rows, counts] = await Promise.all([
      pool.query(
        `SELECT ${COLS}, COUNT(*) OVER()::int AS total FROM manufacturers
         WHERE ($1::text IS NULL OR name ILIKE $1 OR license_number ILIKE $1 OR wallet_address ILIKE $1)
           AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
        [like, wanted, PAGE_SIZE, (page - 1) * PAGE_SIZE]),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'active')::int  AS approved,
                         COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
                         COUNT(*) FILTER (WHERE status = 'revoked')::int AS revoked
                  FROM manufacturers`),
    ]);
    res.status(200).json({
      items: rows.rows.map(toApi),
      total: rows.rows[0]?.total ?? 0,
      page, pageSize: PAGE_SIZE,
      counts: counts.rows[0],
    });
  } catch (e) {
    console.error('Error listing manufacturers:', e.message);
    res.status(500).json({ error: 'Server error while loading manufacturers' });
  }
};

// Step 1: save the details as "pending". Nothing is on-chain yet.
const createManufacturer = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const licence = String(req.body.licenseNumber || '').trim().toUpperCase();
    const country = String(req.body.country || 'Rwanda');
    const rawWallet = String(req.body.wallet || '').trim();

    if (name.length < 2 || name.length > 150) return res.status(400).json({ error: 'Enter the manufacturer name (2–150 characters).' });
    if (!LICENCE.test(licence)) return res.status(400).json({ error: 'Enter a valid licence number, e.g. FDA-MFG-0084.' });
    if (!ethers.isAddress(rawWallet)) return res.status(400).json({ error: 'Enter a valid wallet address (0x followed by 40 characters).' });
    if (!COUNTRIES.includes(country)) return res.status(400).json({ error: 'Choose a country from the list.' });
    const wallet = rawWallet.toLowerCase();

    const dup = await pool.query(
      'SELECT license_number, wallet_address FROM manufacturers WHERE license_number = $1 OR wallet_address = $2',
      [licence, wallet]);
    if (dup.rows.length) {
      const sameLicence = dup.rows.some((r) => r.license_number === licence);
      return res.status(409).json({
        error: sameLicence ? 'That licence number is already registered.' : 'That wallet address belongs to another manufacturer.',
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO manufacturers (name, license_number, license_hash, wallet_address, country, status, created_by)
       VALUES ($1,$2,$3,$4,$5,'pending',$6) RETURNING ${COLS}`,
      [name, licence, licenseHash(licence), wallet, country, req.user.id]);
    res.status(201).json({ manufacturer: toApi(rows[0]), licenseHash: licenseHash(licence) });
  } catch (e) {
    console.error('Error creating manufacturer:', e.message);
    res.status(500).json({ error: 'Server error while saving the manufacturer' });
  }
};

const fail = (status, error) => Object.assign(new Error(error), { status });

/**
 * Step 2: the regulator signed a transaction in MetaMask. The server never signs; it reads the
 * receipt from the chain and only believes what the contract's own events say.
 */
const confirmManufacturer = async (req, res) => {
  const client = await pool.connect();
  try {
    const txHash = String(req.body.txHash || '');
    if (!TX.test(txHash)) throw fail(400, 'A valid transaction hash is required.');

    const mf = (await client.query('SELECT * FROM manufacturers WHERE id = $1', [req.params.id])).rows[0];
    if (!mf) throw fail(404, 'Manufacturer not found.');

    const actor = (await client.query('SELECT wallet_address FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!actor?.wallet_address) throw fail(400, 'Your account has no wallet linked, so it cannot sign on-chain actions.');
    const actorWallet = actor.wallet_address.toLowerCase();

    const dep = await assertDeployed();
    let receipt, block;
    try {
      receipt = await getProvider().getTransactionReceipt(txHash);
      if (receipt) block = await getProvider().getBlock(receipt.blockNumber);
    } catch { throw fail(502, 'Could not read the transaction from the blockchain node.'); }
    if (!receipt) throw fail(409, 'The transaction has not been mined yet. Try again in a moment.');
    if (receipt.status !== 1) throw fail(400, 'That transaction failed on-chain.');

    let event = null;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== dep.address.toLowerCase()) continue;
      let parsed; try { parsed = dep.iface.parseLog(log); } catch { continue; }
      if (!parsed) continue;
      const a = parsed.args;
      if (parsed.name === 'ManufacturerRegistered' && a.manufacturer.toLowerCase() === mf.wallet_address
          && a.licenseHash === mf.license_hash && a.regulator.toLowerCase() === actorWallet) event = 'registered';
      if (parsed.name === 'ManufacturerRevoked' && a.manufacturer.toLowerCase() === mf.wallet_address
          && a.regulator.toLowerCase() === actorWallet) event = 'revoked';
    }
    if (!event) throw fail(400, 'That transaction does not match this manufacturer and your wallet.');

    const target = event === 'registered' ? 'active' : 'revoked';
    const hashCol = event === 'registered' ? 'register_tx_hash' : 'revoke_tx_hash';
    if (mf.status === target && mf[hashCol] === txHash) {          // retry of an already-recorded tx
      return res.status(200).json({ manufacturer: toApi((await pool.query(`SELECT ${COLS} FROM manufacturers WHERE id=$1`, [mf.id])).rows[0]) });
    }
    if (event === 'registered' && mf.status === 'active') throw fail(409, 'This manufacturer is already approved.');
    if (event === 'revoked' && mf.status !== 'active') throw fail(409, 'Only approved manufacturers can be revoked.');

    await client.query('BEGIN');
    const upd = event === 'registered'
      ? `UPDATE manufacturers SET status='active', register_tx_hash=$2, approved_at=to_timestamp($3) AT TIME ZONE 'UTC', revoked_at=NULL WHERE id=$1`
      : `UPDATE manufacturers SET status='revoked', revoke_tx_hash=$2, revoked_at=to_timestamp($3) AT TIME ZONE 'UTC' WHERE id=$1`;
    await client.query(upd, [mf.id, txHash, block.timestamp]);
    await recordAudit({
      actor_id: req.user.id, actor_wallet: actorWallet,
      action: event === 'registered' ? 'manufacturer.register' : 'manufacturer.revoke',
      entity_type: 'manufacturer', entity_id: mf.id, tx_hash: txHash,
      details: { name: mf.name, licenseNumber: mf.license_number, wallet: mf.wallet_address, block: receipt.blockNumber },
    }, client);
    await client.query('COMMIT');

    const fresh = (await pool.query(`SELECT ${COLS} FROM manufacturers WHERE id=$1`, [mf.id])).rows[0];
    res.status(200).json({ manufacturer: toApi(fresh) });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    if (!e.status) console.error('Error confirming manufacturer:', e.message);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error while confirming the transaction' });
  } finally {
    client.release();
  }
};

module.exports = { listManufacturers, createManufacturer, confirmManufacturer, COUNTRIES };
