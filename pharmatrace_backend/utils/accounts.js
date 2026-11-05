// Regulator-issued accounts. A person never picks their first password: the server makes a temporary one,
// shows it to the regulator once (and emails it when email is configured), and forces a change at first sign-in.
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { recordAudit } = require('./audit');
const { generateTempPassword, isEmail } = require('./password');
const { sendMail, loginText } = require('./mailer');

const where = (role) => (role === 'pharmacist'
  ? 'the PharmaTrace mobile app'
  : process.env.DASHBOARD_URL || 'the PharmaTrace dashboard');

async function audit(entry) {
  try { await recordAudit(entry); } catch (e) { console.error('Could not write audit entry:', e.message); }
}

async function mailLogin(user, password) {
  if (!isEmail(user.contact)) return false;
  const r = await sendMail({
    to: user.contact,
    subject: 'Your PharmaTrace account',
    text: loginText({ name: user.name, where: where(user.role), contact: user.contact, password }),
  });
  return r.sent;
}

/** Creates the user row. The caller has already checked that the contact is free. */
async function createAccount({ name, role, contact, sector = null, wallet = null, manufacturerId = null, actorId }) {
  const temporaryPassword = generateTempPassword();
  const hash = await bcrypt.hash(temporaryPassword, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, role, wallet_address, contact, password_hash, sector, manufacturer_id, must_change_password, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true,true)
     RETURNING id, name, role, contact, sector`,
    [name, role, wallet, contact, hash, sector, manufacturerId]);
  const user = rows[0];
  await audit({ actor_id: actorId, action: 'account.create', entity_type: 'user', entity_id: user.id, details: { name: user.name, role } });
  const emailSent = await mailLogin(user, temporaryPassword);
  return { user, temporaryPassword, emailSent };
}

/** New temporary password for an existing account; the person must change it at next sign-in. */
async function resetAccount({ userId, actorId }) {
  const temporaryPassword = generateTempPassword();
  const hash = await bcrypt.hash(temporaryPassword, 10);
  const { rows } = await pool.query(
    `UPDATE users SET password_hash = $2, must_change_password = true, is_active = true
      WHERE id = $1 RETURNING id, name, role, contact, sector`,
    [userId, hash]);
  const user = rows[0];
  if (!user) return null;
  await pool.query("UPDATE password_resets SET used_at = (now() AT TIME ZONE 'UTC') WHERE user_id = $1 AND used_at IS NULL", [userId]);
  await audit({ actor_id: actorId, action: 'account.reset', entity_type: 'user', entity_id: user.id, details: { name: user.name, role: user.role } });
  const emailSent = await mailLogin(user, temporaryPassword);
  return { user, temporaryPassword, emailSent };
}

module.exports = { createAccount, resetAccount };
