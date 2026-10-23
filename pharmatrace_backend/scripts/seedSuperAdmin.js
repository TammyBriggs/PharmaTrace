const bcrypt = require('bcrypt');
const pool = require('../config/db');

(async () => {
  const { SEED_NAME = 'Super Admin', SEED_CONTACT, SEED_PASSWORD, SEED_WALLET } = process.env;
  if (!SEED_CONTACT || !SEED_PASSWORD) throw new Error('Set SEED_CONTACT and SEED_PASSWORD');
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (name, role, wallet_address, contact, password_hash)
     VALUES ($1, 'super_admin', $2, $3, $4)
     ON CONFLICT (contact) DO NOTHING`,
    [SEED_NAME, SEED_WALLET || null, SEED_CONTACT, hash],
  );
  console.log('Super admin ready:', SEED_CONTACT);
  await pool.end();
})().catch((e) => { console.error(e.message); process.exit(1); });