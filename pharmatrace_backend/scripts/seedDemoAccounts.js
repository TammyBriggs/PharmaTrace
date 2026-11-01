// Sets up the two demo personas on the LOCAL chain and in Neon (safe to re-run):
//   Hardhat #1 -> regulator (gets REGULATOR_ROLE on-chain, plus a dashboard login)
//   Hardhat #2 -> manufacturer (registered on-chain by the regulator, plus a dashboard login)
// Hardhat #0 stays the super admin (debugging only). Run after deploy.js and resetDemoData.js:
//   cd pharmatrace_backend
//   REGULATOR_CONTACT=regulator@pharmatrace.rw REGULATOR_PASSWORD='...' \
//   MANUFACTURER_CONTACT=manufacturer@pharmatrace.rw MANUFACTURER_PASSWORD='...' \
//   node scripts/seedDemoAccounts.js
// Optional: REGULATOR_NAME, MANUFACTURER_NAME (company), MANUFACTURER_LICENCE, MANUFACTURER_COUNTRY.
// LOCAL ONLY: it uses Hardhat's public keys and refuses any chain except 31337.
const bcrypt = require('bcrypt');
const { ethers } = require('ethers');
const pool = require('../config/db');
const { getProvider, assertDeployed } = require('../config/chain');
const { recordAudit } = require('../utils/audit');

const KEY0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'; // account #0 (admin)
const KEY1 = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // account #1 (regulator)
const MFR_WALLET = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';                    // account #2 (manufacturer)

(async () => {
  const e = process.env;
  for (const k of ['REGULATOR_CONTACT', 'REGULATOR_PASSWORD', 'MANUFACTURER_CONTACT', 'MANUFACTURER_PASSWORD'])
    if (!e[k]) throw new Error(`Set ${k}`);
  const company = e.MANUFACTURER_NAME || 'Macleods Pharmaceuticals Limited';
  const licence = e.MANUFACTURER_LICENCE || 'DEMO-MFG-0001';
  const country = e.MANUFACTURER_COUNTRY || 'India';

  const dep = await assertDeployed();
  if (dep.chainId !== 31337) throw new Error('Refusing: local Hardhat chain only.');
  const provider = getProvider();
  const admin = new ethers.Wallet(KEY0, provider);
  const regulator = new ethers.Wallet(KEY1, provider);
  const asAdmin = new ethers.Contract(dep.address, dep.abi, admin);
  const asRegulator = new ethers.Contract(dep.address, dep.abi, regulator);

  // 1) On-chain: admin grants the regulator role to #1; regulator registers #2.
  const REG = await asAdmin.REGULATOR_ROLE();
  if (!(await asAdmin.hasRole(REG, regulator.address))) {
    await (await asAdmin.grantRole(REG, regulator.address)).wait();
    console.log('Granted REGULATOR_ROLE to', regulator.address);
  }
  const MFR = await asAdmin.MANUFACTURER_ROLE();
  let txHash = null;
  if (!(await asAdmin.hasRole(MFR, MFR_WALLET))) {
    const rc = await (await asRegulator.registerManufacturer(MFR_WALLET, ethers.id(licence))).wait();
    txHash = rc.hash;
    console.log('Manufacturer registered on-chain:', txHash);
  }

  // 2) Neon: regulator user, manufacturer row, manufacturer user, audit entry.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const upsertUser = async (name, role, wallet, contact, password, manufacturerId) =>
      (await client.query(
        `INSERT INTO users (name, role, wallet_address, contact, password_hash, manufacturer_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (contact) DO UPDATE SET name=$1, role=$2, wallet_address=$3, password_hash=$5,
           manufacturer_id=$6, is_active=true, must_change_password=false
         RETURNING id`,
        [name, role, ethers.getAddress(wallet), contact, await bcrypt.hash(password, 10), manufacturerId])).rows[0].id;

    const regId = await upsertUser(e.REGULATOR_NAME || 'Rwanda FDA Regulator', 'regulator', regulator.address, e.REGULATOR_CONTACT, e.REGULATOR_PASSWORD, null);

    let mf = (await client.query('SELECT id FROM manufacturers WHERE wallet_address = $1', [MFR_WALLET.toLowerCase()])).rows[0];
    if (mf) {
      await client.query(`UPDATE manufacturers SET status='active', revoked_at=NULL, approved_at=COALESCE(approved_at, now()),
        register_tx_hash=COALESCE($2, register_tx_hash) WHERE id=$1`, [mf.id, txHash]);
    } else {
      mf = (await client.query(
        `INSERT INTO manufacturers (name, license_number, license_hash, wallet_address, country, status, register_tx_hash, approved_at, created_by)
         VALUES ($1,$2,$3,$4,$5,'active',$6, now(), $7) RETURNING id`,
        [company, licence, ethers.id(licence), MFR_WALLET.toLowerCase(), country, txHash, regId])).rows[0];
      await recordAudit({ actor_id: regId, actor_wallet: regulator.address, action: 'manufacturer.register',
        entity_type: 'manufacturer', entity_id: mf.id, tx_hash: txHash,
        details: { name: company, licenseNumber: licence, wallet: MFR_WALLET.toLowerCase(), seeded: true } }, client);
    }
    await upsertUser(company, 'manufacturer', MFR_WALLET, e.MANUFACTURER_CONTACT, e.MANUFACTURER_PASSWORD, mf.id);
    await client.query('COMMIT');
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); throw err; } finally { client.release(); }

  console.log(`Regulator login: ${e.REGULATOR_CONTACT}  (wallet #1 ${regulator.address})`);
  console.log(`Manufacturer login: ${e.MANUFACTURER_CONTACT}  (${company}, wallet #2 ${MFR_WALLET})`);
  await pool.end();
})().catch((err) => { console.error('Seed failed:', err.message); process.exit(1); });
