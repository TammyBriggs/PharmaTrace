// Fills the dashboard with a realistic demo dataset: 6 manufacturers (Hardhat wallets #3 to #8), about 50 batches in
// mixed states, serial numbers, scan history across Gasabo's sectors, and a few pharmacist flag reports.
//
//   cd pharmatrace_backend
//   node scripts/seedDemoData.js --yes
//
// What it does, in order:
//   1. Erases all manufacturers, batches, serials, scan events and flag reports (the same reset as resetDemoData.js).
//      Regulator, super admin and pharmacist accounts are kept. Old manufacturer logins are kept but deactivated and
//      renamed, because the audit log refers to them and must never lose history.
//   2. Registers 6 manufacturers ON THE LOCAL CHAIN (regulator #1 signs), then each manufacturer submits its batches and
//      the regulator approves / flags / revokes them, so every seeded batch has real transaction hashes and the
//      verify endpoint reads the same state from the contract.
//   3. Writes the matching database rows, audit entries and serial numbers exactly as the API does.
//   4. Back-dates the DATABASE timestamps over the last ~75 days so charts show a history. Transaction hashes are real,
//      but block times on the local chain are "now". This is demo data only.
//
// Hardhat wallet #2 and the manufacturer "Macleods Pharmaceuticals Limited" are NOT seeded: add them in the dashboard
// during the demo. Run on a FRESH chain (restart `npx hardhat node`, redeploy, seed the regulator with seedDemoAccounts
// or your own login). LOCAL ONLY: it uses Hardhat's public keys and refuses any chain except 31337.
// Optional: SEED_MANUFACTURER_PASSWORD (otherwise a random one is printed once) for the 6 manufacturer logins.
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { ethers, HDNodeWallet } = require('ethers');
const pool = require('../config/db');
const { getProvider, assertDeployed } = require('../config/chain');
const { recordAudit } = require('../utils/audit');
const { buildTree } = require('../utils/merkle');
const { deriveGtin, randomSerial } = require('../utils/gs1');
const { resetDemoData } = require('./resetDemoData');
const { importRows, parseCsv } = require('./importCatalog');
const { reasonHashOf, batchIdOf, addMonths } = require('../controllers/batchController');
const fs = require('fs');
const path = require('path');

const MNEMONIC = 'test test test test test test test test test test test junk'; // public Hardhat dev phrase
const walletOf = (i, provider) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${i}`).connect(provider);

const MANUFACTURERS = [
  { name: 'Ajanta Pharma Limited', code: 'AJA', slug: 'ajanta' },
  { name: 'Bliss Gvs Pharma Limited', code: 'BLS', slug: 'bliss' },
  { name: 'Hetero Labs Limited', code: 'HET', slug: 'hetero' },
  { name: 'Mylan Laboratories Limited', code: 'MYL', slug: 'mylan' },
  { name: 'Cosmos Limited', code: 'COS', slug: 'cosmos' },
  { name: 'Aura Lifecare Pvt. Ltd', code: 'AUR', slug: 'aura' },
];
// Gasabo's 15 sectors, weighted so the busiest ones lead the analytics.
const SECTORS = [['Remera', 9], ['Kimironko', 9], ['Kacyiru', 7], ['Gisozi', 6], ['Kinyinya', 5], ['Kimihurura', 5], ['Jabana', 3],
  ['Ndera', 3], ['Gatsata', 3], ['Rusororo', 2], ['Nduba', 2], ['Bumbogo', 1], ['Gikomero', 1], ['Jali', 1], ['Rutunga', 1]];
// The mix of final states, cycled across batches (about 66% approved).
const STATES = ['approved', 'approved', 'approved', 'pending', 'approved', 'flagged', 'approved', 'approved', 'revoked', 'approved', 'pending', 'approved'];
const QUANTITIES = [120, 150, 200, 240, 300, 360, 480, 600];
const FLAGS = [['Suspected counterfeit', 'Pharmacists reported packaging that does not match the registered artwork.'],
  ['Packaging mismatch', 'Carton print quality and lot code format differ from the approved sample.'],
  ['Quality defect', 'Tablets reported crumbling on handling; batch held pending laboratory test.'],
  ['Failed laboratory test', 'Dissolution result below specification in the regulator laboratory.']];
const REVOKES = [['Manufacturer recall', 'The manufacturer issued a voluntary recall for this batch.'],
  ['Failed laboratory test', 'Assay result outside the permitted range; the batch is withdrawn.']];

// Small deterministic random generator so every run builds the same dataset.
const rng = (() => { let a = 20261102; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const weighted = (pairs) => { let r = rng() * pairs.reduce((s, [, w]) => s + w, 0); for (const [v, w] of pairs) { if ((r -= w) < 0) return v; } return pairs[0][0]; };
const day = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
// Timestamp columns here are 'timestamp without time zone' holding UTC, so send a UTC string, never a local Date.
const U = (d) => (d ? d.toISOString().slice(0, 23) : null);
const unix = (dayStr) => Math.floor(Date.parse(`${dayStr}T00:00:00Z`) / 1000);

async function ensureProducts() {
  const have = (await pool.query('SELECT COUNT(*)::int AS n FROM products')).rows[0].n;
  if (have > 0) return;
  console.log('Product catalogue is empty: importing data/demo_catalog.csv first.');
  await importRows(pool, parseCsv(fs.readFileSync(path.join(__dirname, '..', 'data', 'demo_catalog.csv'), 'utf8')));
}

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log('This ERASES all manufacturers, batches, serials, scan events and flag reports, then seeds demo data.');
    console.log('Run again with --yes to confirm.');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to run with NODE_ENV=production.');

  const dep = await assertDeployed();
  if (dep.chainId !== 31337) throw new Error('Refusing: local Hardhat chain only.');
  const provider = getProvider();
  provider.pollingInterval = 150; // Hardhat mines instantly; do not wait the default 4 s per transaction.
  const admin = walletOf(0, provider);
  const regulator = walletOf(1, provider);
  const contract = new ethers.Contract(dep.address, dep.abi, admin);
  const asRegulator = contract.connect(regulator);

  const regRole = await contract.REGULATOR_ROLE();
  if (!(await contract.hasRole(regRole, regulator.address))) {
    await (await contract.grantRole(regRole, regulator.address)).wait();
    console.log('Granted REGULATOR_ROLE to', regulator.address);
  }
  const mfrRole = await contract.MANUFACTURER_ROLE();
  if (await contract.hasRole(mfrRole, walletOf(2, provider).address)) {
    console.log('WARNING: wallet #2 (Macleods) is already registered on this chain. Adding it again in the dashboard will fail.');
    console.log('         For a clean demo restart `npx hardhat node`, redeploy, then run this script.');
  }

  await ensureProducts();

  // 1. Reset.
  const removed = await resetDemoData({ includeReports: true });
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const archived = await pool.query(
    `UPDATE users SET contact = contact || $1, is_active = false WHERE role = 'manufacturer' AND contact NOT LIKE '%.archived-%'`, [`.archived-${stamp}`]);
  console.log('Reset done. Removed:', removed, '| old manufacturer logins deactivated:', archived.rowCount);

  const regUser = (await pool.query(`SELECT id FROM users WHERE role = 'regulator' AND is_active ORDER BY created_at LIMIT 1`)).rows[0];
  if (!regUser) throw new Error('No regulator login found. Create one first (node scripts/seedDemoAccounts.js ...).');
  const pharmacists = (await pool.query(`SELECT id, sector FROM users WHERE role = 'pharmacist' AND is_active`)).rows;
  const password = process.env.SEED_MANUFACTURER_PASSWORD || crypto.randomBytes(6).toString('base64url');
  const passwordHash = await bcrypt.hash(password, 10);

  const summary = [];
  const scanRows = []; // collected, then inserted in bulk
  const batchPool = []; // every created batch, used to spread the scans
  let counter = 0;

  for (let mi = 0; mi < MANUFACTURERS.length; mi++) {
    const m = MANUFACTURERS[mi];
    const signer = walletOf(3 + mi, provider);
    const asMfr = contract.connect(signer);
    const products = (await pool.query('SELECT * FROM products WHERE manufacturer_name = $1 ORDER BY registration_number LIMIT 6', [m.name])).rows;
    if (!products.length) { console.log(`Skipping ${m.name}: no products in the catalogue.`); continue; }
    const licence = `DEMO-MFG-${String(3 + mi).padStart(4, '0')}`;

    // 2a. Register the manufacturer on-chain, then in the database.
    // Already registered on this chain (a re-run without restarting the node)? Keep it and just record it in the database.
    const rc = (await contract.hasRole(mfrRole, signer.address))
      ? { hash: null }
      : await (await asRegulator.registerManufacturer(signer.address, ethers.id(licence))).wait();
    const approvedAt = daysAgo(80 + mi);
    const mf = (await pool.query(
      `INSERT INTO manufacturers (name, license_number, license_hash, wallet_address, country, status, register_tx_hash, approved_at, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$7,$8) RETURNING id`,
      [m.name, licence, ethers.id(licence), signer.address.toLowerCase(), products[0].country || 'India', rc.hash, U(approvedAt), regUser.id])).rows[0];
    const user = (await pool.query(
      `INSERT INTO users (name, role, wallet_address, contact, password_hash, manufacturer_id)
       VALUES ($1,'manufacturer',$2,$3,$4,$5)
       ON CONFLICT (contact) DO UPDATE SET password_hash=$4, manufacturer_id=$5, is_active=true, must_change_password=false RETURNING id`,
      [m.name, signer.address, `${m.slug}@demo.pharmatrace.rw`, passwordHash, mf.id])).rows[0];
    await recordAudit({ actor_id: regUser.id, actor_wallet: regulator.address, action: 'manufacturer.register', entity_type: 'manufacturer',
      entity_id: mf.id, tx_hash: rc.hash, details: { name: m.name, licenseNumber: licence, wallet: signer.address.toLowerCase(), seeded: true } });

    // 2b. Batches: one or two per product.
    let made = 0;
    for (const p of products) {
      for (let k = 0; k < (rng() < 0.45 ? 2 : 1); k++) {
        const state = STATES[counter % STATES.length]; counter++;
        const submittedDaysAgo = between(6, 74);
        const soon = counter === 7; // one batch that expires within about a month (shows the "expiring soon" view)
        let mfg = day(daysAgo(submittedDaysAgo + between(10, 90)));
        let expiry = addMonths(mfg, p.shelf_life_months);
        if (soon) { mfg = addMonths(day(new Date()), -(p.shelf_life_months - 1)); expiry = addMonths(mfg, p.shelf_life_months); }
        else if (expiry <= day(daysAgo(-90))) { mfg = day(daysAgo(submittedDaysAgo + 15)); expiry = addMonths(mfg, p.shelf_life_months); }
        const quantity = pick(QUANTITIES);
        const batchNo = `${m.code}-${mfg.slice(2, 4)}${mfg.slice(5, 7)}-${String(made + 1).padStart(3, '0')}`;
        const gtin = deriveGtin(p.registration_number);
        const metadataHash = ethers.id(JSON.stringify([gtin, batchNo, p.registration_number, p.brand_name, p.generic_name,
          p.strength, p.dosage_form, p.pack_size, quantity, mfg, expiry]));
        const batchId = batchIdOf(signer.address, batchNo);
        const drugName = `${p.generic_name} ${p.strength}`.slice(0, 150);

        // Chain: submit, then approve (and flag / revoke).
        // Pack serials come first: their Merkle root is signed into the same transaction that submits the batch.
        const serials = new Set();
        while (serials.size < quantity) serials.add(randomSerial());
        const tree = buildTree(batchId, [...serials]);
        const submitRc = await (await asMfr.submitBatch(batchNo, metadataHash, unix(mfg), unix(expiry), tree.root, tree.count)).wait();
        const events = [{ event: 'submitted', tx: submitRc.hash, actor: user.id, wallet: signer.address, at: daysAgo(submittedDaysAgo), reason: null, notes: null }];
        let status = 'pending', flagInfo = null, revokeInfo = null;
        let t = submittedDaysAgo - rng() * 2.5;
        if (state !== 'pending') {
          const r = await (await asRegulator.approveBatch(batchId)).wait();
          events.push({ event: 'approved', tx: r.hash, actor: regUser.id, wallet: regulator.address, at: daysAgo(Math.max(t, 1)), reason: null, notes: null });
          status = 'approved';
          if (state === 'flagged') {
            const [reason, notes] = pick(FLAGS); t = Math.max(t - rng() * 12 - 2, 0.5);
            const f = await (await asRegulator.flagBatch(batchId, reasonHashOf(reason, notes))).wait();
            events.push({ event: 'flagged', tx: f.hash, actor: regUser.id, wallet: regulator.address, at: daysAgo(t), reason, notes });
            status = 'flagged'; flagInfo = { reason, notes, tx: f.hash, at: daysAgo(t) };
          } else if (state === 'revoked') {
            const [reason, notes] = pick(REVOKES); t = Math.max(t - rng() * 10 - 2, 0.5);
            const v = await (await asRegulator.revokeBatch(batchId, reasonHashOf(reason, notes))).wait();
            events.push({ event: 'revoked', tx: v.hash, actor: regUser.id, wallet: regulator.address, at: daysAgo(t), reason, notes });
            status = 'revoked'; revokeInfo = { reason, notes, tx: v.hash, at: daysAgo(t) };
          }
        }

        // Database: the same rows the API writes.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const approvedEv = events.find((e) => e.event === 'approved');
          const b = (await client.query(
            `INSERT INTO batches (manufacturer_id, batch_no, gtin, drug_name, category, mfg_date, expiry_date, quantity, batch_id_hash, metadata_hash,
                                  status, submit_tx_hash, created_by, created_at, product_id, approved_at, approve_tx_hash,
                                  flag_reason, flag_notes, flag_tx_hash, flagged_at, revoke_reason, revoke_notes, revoke_tx_hash, revoked_at,
                                  serial_root, serial_count)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) RETURNING id`,
            [mf.id, batchNo, gtin, drugName, p.category, mfg, expiry, quantity, batchId, metadataHash, status, submitRc.hash, user.id, U(events[0].at), p.id,
              U(approvedEv?.at), approvedEv?.tx ?? null, flagInfo?.reason ?? null, flagInfo?.notes ?? null, flagInfo?.tx ?? null, U(flagInfo?.at),
              revokeInfo?.reason ?? null, revokeInfo?.notes ?? null, revokeInfo?.tx ?? null, U(revokeInfo?.at), tree.root, tree.count])).rows[0];
          for (const e of events) {
            await client.query(`INSERT INTO batch_events (batch_uuid, event, actor_id, actor_wallet, tx_hash, reason, notes, block_time)
                                VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [b.id, e.event, e.actor, e.wallet, e.tx, e.reason, e.notes, U(e.at)]);
          }
          await client.query('INSERT INTO serials (batch_uuid, serial) SELECT $1, unnest($2::text[])', [b.id, [...serials]]);
          const act = { submitted: 'batch.submit', approved: 'batch.approve', flagged: 'batch.flag', revoked: 'batch.revoke' };
          for (const e of events) {
            await recordAudit({ actor_id: e.actor, actor_wallet: e.wallet, action: act[e.event], entity_type: 'batch', entity_id: b.id, tx_hash: e.tx,
              details: { batchNo, drug: drugName, manufacturer: m.name, ...(e.reason ? { reason: e.reason } : {}), seeded: true } }, client);
          }
          await client.query('COMMIT');
          batchPool.push({ id: b.id, status, serials: [...serials].slice(0, 30), from: approvedEv?.at ?? events[0].at, flaggedAt: flagInfo?.at ?? null, batchNo, gtin });
        } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; } finally { client.release(); }
        made++;
      }
    }
    summary.push({ manufacturer: m.name, wallet: `#${3 + mi}`, batches: made, login: `${m.slug}@demo.pharmatrace.rw` });
    console.log(`  ${m.name}: ${made} batches`);
  }

  // 3. Scan history: spread over the time after each batch was approved; flagged batches get a recent spike.
  const verdictOf = { approved: 'authentic', pending: 'pending', flagged: 'flagged', revoked: 'revoked' };
  const scannable = batchPool.filter((b) => b.status !== 'pending' || rng() < 0.3);
  for (let i = 0; i < 700; i++) {
    const b = pick(scannable);
    const ageDays = rng() < 0.55 ? rng() * 14 : rng() * 70; // more recent scans than old ones
    let at = daysAgo(ageDays);
    if (at < b.from) at = new Date(b.from.getTime() + rng() * (Date.now() - b.from.getTime()));
    if (b.status === 'flagged' && rng() < 0.6) at = daysAgo(rng() * 8); // spike on flagged batches
    const pharmacist = pharmacists.length && rng() < 0.35 ? pick(pharmacists) : null;
    const sector = SECTORS.some(([s]) => s === pharmacist?.sector) ? pharmacist.sector : weighted(SECTORS);
    const serial = rng() < 0.6 ? pick(b.serials) : null;
    scanRows.push({ batch: b.id, serial, raw: `/01/${b.gtin}/10/${b.batchNo}${serial ? `/21/${serial}` : ''}`, sector, verdict: verdictOf[b.status], by: pharmacist?.id ?? null, at });
  }
  for (let i = 0; i < 18; i++) { // codes the register does not know (counterfeit attempts)
    scanRows.push({ batch: null, serial: null, raw: `/01/${deriveGtin(`UNKNOWN-${i}`)}/10/ZX${between(1000, 9999)}`, sector: weighted(SECTORS), verdict: 'not_found', by: null, at: daysAgo(rng() * 30) });
  }
  const col = (k) => scanRows.map((r) => r[k]);
  await pool.query(
    `INSERT INTO scan_events (batch_uuid, serial, raw_code, sector, verdict, scanned_by, scanned_at)
     SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::uuid[], $7::timestamp[])`,
    [col('batch'), col('serial'), col('raw'), col('sector'), col('verdict'), col('by'), scanRows.map((r) => U(r.at))]);

  // 4. A few packs already sold, and a few pharmacist flag reports (open, under review, closed).
  const sold = await pool.query(
    `UPDATE serials SET status='dispensed', dispensed_at = now() - (random() * interval '20 days'), updated_at = now()
      WHERE id IN (SELECT s.id FROM serials s JOIN batches b ON b.id = s.batch_uuid WHERE b.status='approved' ORDER BY random() LIMIT 40)`);
  const flaggedBatches = batchPool.filter((b) => b.status === 'flagged' || b.status === 'revoked').slice(0, 6);
  const states = ['open', 'open', 'open', 'under_review', 'closed', 'closed'];
  for (let i = 0; i < flaggedBatches.length; i++) {
    const closed = states[i] === 'closed';
    await pool.query(
      `INSERT INTO flag_reports (batch_id, flagged_by, reason, location, reported_at, status, reviewed_by, reviewed_at, review_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [flaggedBatches[i].batchNo, pharmacists.length ? pharmacists[i % pharmacists.length].id : null,
        pick(['Packaging looks different from the last delivery.', 'Blister foil is dull and the lot code is smudged.', 'Customer reported an unusual taste and colour.', 'Carton barcode does not scan.']),
        `${pick(SECTORS)[0]}, Gasabo`, U(daysAgo(between(1, 20))), states[i], closed || states[i] === 'under_review' ? regUser.id : null,
        closed || states[i] === 'under_review' ? U(daysAgo(between(0, 3))) : null, closed ? 'Reviewed with the manufacturer; batch action recorded.' : null]);
  }

  console.table(summary);
  const t = (await pool.query(`SELECT COUNT(*) FILTER (WHERE status='approved')::int AS approved, COUNT(*) FILTER (WHERE status='pending')::int AS pending,
    COUNT(*) FILTER (WHERE status='flagged')::int AS flagged, COUNT(*) FILTER (WHERE status='revoked')::int AS revoked FROM batches`)).rows[0];
  console.log('Batches:', t, '| scans:', scanRows.length, '| packs marked sold:', sold.rowCount, '| flag reports:', flaggedBatches.length);
  console.log(`Manufacturer logins: <slug>@demo.pharmatrace.rw, password: ${password}`);
  console.log('Next: in the dashboard add "Macleods Pharmaceuticals Limited" with wallet #2 (0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC)');
  console.log('and a login email. The dashboard shows its temporary password once; the manufacturer changes it at first sign-in.');
  await pool.end();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
