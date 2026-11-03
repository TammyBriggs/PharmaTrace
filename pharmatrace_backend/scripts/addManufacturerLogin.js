// Creates (or resets) the dashboard login for a manufacturer that already exists in the database.
// The "Add manufacturer" form records the licence, wallet, name and country only; it does not create a login.
//
//   cd pharmatrace_backend
//   node scripts/addManufacturerLogin.js "Macleods" tbreegz21@gmail.com "YourPassword#1"
//
// Arguments: <part of the manufacturer name> <login email> <password>
// Safe to run again: it updates the password if the email already has a login.
const bcrypt = require('bcrypt');
const pool = require('../config/db');

(async () => {
  const [, , nameLike, contact, password] = process.argv;
  if (!nameLike || !contact || !password) {
    console.error('Usage: node scripts/addManufacturerLogin.js "<manufacturer name>" <email> <password>');
    process.exit(1);
  }
  try {
    const { rows } = await pool.query(
      'SELECT id, name, wallet_address FROM manufacturers WHERE name ILIKE $1 ORDER BY id DESC',
      [`%${nameLike}%`],
    );
    if (rows.length === 0) {
      console.error(`No manufacturer matching "${nameLike}". Add it in the regulator dashboard first.`);
      process.exit(1);
    }
    if (rows.length > 1) {
      console.log(`Note: ${rows.length} manufacturers match; using the newest: ${rows[0].name}`);
    }
    const m = rows[0];
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO users (name, role, wallet_address, contact, password_hash, manufacturer_id, is_active, must_change_password)
       VALUES ($1, 'manufacturer', $2, $3, $4, $5, true, false)
       ON CONFLICT (contact) DO UPDATE SET
         name = $1, role = 'manufacturer', wallet_address = $2, password_hash = $4,
         manufacturer_id = $5, is_active = true, must_change_password = false`,
      [m.name, m.wallet_address, contact, hash, m.id],
    );
    console.log(`Login ready for ${m.name}\n  email:    ${contact}\n  password: ${password}`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
